package costmodel

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/julienschmidt/httprouter"

	"github.com/opencost/opencost/core/pkg/filter/allocation"
	"github.com/opencost/opencost/core/pkg/opencost"
	"github.com/opencost/opencost/core/pkg/util/httputil"
	"github.com/opencost/opencost/pkg/env"
)

// Efficiency calculation constants
const (
	EfficiencyBufferMultiplier = 1.2                  // 20% headroom for stability
	EfficiencyMinCPU           = 0.001                // minimum CPU cores
	EfficiencyMinRAM           = float64(1024 * 1024) // 1 MB minimum RAM
)

// EfficiencyResponse represents the efficiency data returned by the API.
type EfficiencyResponse struct {
	Efficiencies []*EfficiencyMetric `json:"efficiencies"`
}

// EfficiencyMetric represents efficiency data for a single pod/workload.
type EfficiencyMetric struct {
	Name string `json:"name"` // Pod/namespace/controller name based on aggregation

	// Current state
	CPUEfficiency    float64 `json:"cpuEfficiency"`    // Usage / Request ratio (0-1+)
	MemoryEfficiency float64 `json:"memoryEfficiency"` // Usage / Request ratio (0-1+)

	// Current requests and usage
	CPUCoresRequested float64 `json:"cpuCoresRequested"`
	CPUCoresUsed      float64 `json:"cpuCoresUsed"`
	RAMBytesRequested float64 `json:"ramBytesRequested"`
	RAMBytesUsed      float64 `json:"ramBytesUsed"`

	// Recommendations (based on actual usage with buffer)
	RecommendedCPURequest float64 `json:"recommendedCpuRequest"` // Recommended CPU cores
	RecommendedRAMRequest float64 `json:"recommendedRamRequest"` // Recommended RAM bytes

	// Resulting efficiency after applying recommendations
	ResultingCPUEfficiency    float64 `json:"resultingCpuEfficiency"`
	ResultingMemoryEfficiency float64 `json:"resultingMemoryEfficiency"`

	// Cost analysis
	CurrentTotalCost   float64 `json:"currentTotalCost"`   // Current total cost
	RecommendedCost    float64 `json:"recommendedCost"`    // Estimated cost with recommendations
	CostSavings        float64 `json:"costSavings"`        // Potential savings
	CostSavingsPercent float64 `json:"costSavingsPercent"` // Savings as percentage

	// Buffer multiplier used for recommendations
	EfficiencyBufferMultiplier float64 `json:"efficiencyBufferMultiplier"` // Buffer multiplier applied (e.g., 1.2 for 20% headroom)

	// Time window
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

// SafeDiv performs division and returns 0 if denominator is 0.
func SafeDiv(numerator, denominator float64) float64 {
	if denominator == 0 {
		return 0
	}
	return numerator / denominator
}

// ComputeEfficiencyMetric calculates efficiency metrics for a single allocation.
func ComputeEfficiencyMetric(alloc *opencost.Allocation, bufferMultiplier float64) *EfficiencyMetric {
	if alloc == nil {
		return nil
	}

	// Calculate time duration in hours
	hours := alloc.Minutes() / 60.0
	if hours <= 0 {
		return nil
	}

	// Get current usage (average over the period)
	cpuCoresUsed := alloc.CPUCoreHours / hours
	ramBytesUsed := alloc.RAMByteHours / hours

	// Get requested amounts
	cpuCoresRequested := alloc.CPUCoreRequestAverage
	ramBytesRequested := alloc.RAMBytesRequestAverage

	// Calculate current efficiency (will be 0 if no requests are set)
	cpuEfficiency := SafeDiv(cpuCoresUsed, cpuCoresRequested)
	memoryEfficiency := SafeDiv(ramBytesUsed, ramBytesRequested)

	// Calculate recommendations with buffer for headroom
	recommendedCPU := cpuCoresUsed * bufferMultiplier
	recommendedRAM := ramBytesUsed * bufferMultiplier

	// Ensure recommendations meet minimum thresholds
	if recommendedCPU < EfficiencyMinCPU {
		recommendedCPU = EfficiencyMinCPU
	}
	if recommendedRAM < EfficiencyMinRAM {
		recommendedRAM = EfficiencyMinRAM
	}

	// Calculate resulting efficiency after applying recommendations
	resultingCPUEff := SafeDiv(cpuCoresUsed, recommendedCPU)
	resultingMemEff := SafeDiv(ramBytesUsed, recommendedRAM)

	// Calculate cost per unit based on REQUESTED amounts (not used amounts)
	// This gives us the cost per core-hour or byte-hour that the cluster charges
	cpuCostPerCoreHour := SafeDiv(alloc.CPUCost, cpuCoresRequested*hours)
	ramCostPerByteHour := SafeDiv(alloc.RAMCost, ramBytesRequested*hours)

	// Current total cost
	currentTotalCost := alloc.TotalCost()

	// Estimate recommended cost based on recommended requests
	recommendedCPUCost := recommendedCPU * hours * cpuCostPerCoreHour
	recommendedRAMCost := recommendedRAM * hours * ramCostPerByteHour
	// Keep other costs the same (PV, network, shared, external, GPU)
	otherCosts := alloc.PVCost() + alloc.NetworkCost + alloc.SharedCost + alloc.ExternalCost + alloc.GPUCost
	recommendedTotalCost := recommendedCPUCost + recommendedRAMCost + otherCosts

	// Clamp recommended cost to avoid rounding issues making it higher than current
	if recommendedTotalCost > currentTotalCost && (recommendedTotalCost-currentTotalCost) < 0.0001 {
		recommendedTotalCost = currentTotalCost
	}

	// Calculate savings
	costSavings := currentTotalCost - recommendedTotalCost
	costSavingsPercent := SafeDiv(costSavings, currentTotalCost) * 100

	return &EfficiencyMetric{
		Name:                       alloc.Name,
		CPUEfficiency:              cpuEfficiency,
		MemoryEfficiency:           memoryEfficiency,
		CPUCoresRequested:          cpuCoresRequested,
		CPUCoresUsed:               cpuCoresUsed,
		RAMBytesRequested:          ramBytesRequested,
		RAMBytesUsed:               ramBytesUsed,
		RecommendedCPURequest:      recommendedCPU,
		RecommendedRAMRequest:      recommendedRAM,
		ResultingCPUEfficiency:     resultingCPUEff,
		ResultingMemoryEfficiency:  resultingMemEff,
		CurrentTotalCost:           currentTotalCost,
		RecommendedCost:            recommendedTotalCost,
		CostSavings:                costSavings,
		CostSavingsPercent:         costSavingsPercent,
		EfficiencyBufferMultiplier: bufferMultiplier,
		Start:                      alloc.Start,
		End:                        alloc.End,
	}
}

// ComputeEfficiencyHandler computes efficiency metrics from allocation data.
func (a *Accesses) ComputeEfficiencyHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	w.Header().Set("Content-Type", "application/json")

	qp := httputil.NewQueryParams(r.URL.Query())

	// Window is a required field describing the window of time over which to
	// compute efficiency data.
	window, err := opencost.ParseWindowWithOffset(qp.Get("window", ""), env.GetParsedUTCOffset())
	if err != nil {
		http.Error(w, fmt.Sprintf("Invalid 'window' parameter: %s", err), http.StatusBadRequest)
		return
	}

	// Aggregate defaults to namespace
	aggregateStr := qp.Get("aggregate", "namespace")
	aggregateBy := strings.Split(aggregateStr, ",")

	// Filter is an optional allocation filter string
	filterString := qp.Get("filter", "")

	// Buffer multiplier for recommendations (default 1.2 = 20% headroom)
	bufferMultiplier := qp.GetFloat64("buffer", EfficiencyBufferMultiplier)

	// Validate filter if provided
	if filterString != "" {
		parser := allocation.NewAllocationFilterParser()
		_, err := parser.Parse(filterString)
		if err != nil {
			http.Error(w, fmt.Sprintf("Invalid 'filter' parameter: %s", err), http.StatusBadRequest)
			return
		}
	}

	// Query allocations using the full window as step
	step := window.Duration()
	asr, err := a.Model.QueryAllocation(
		window,
		step,
		aggregateBy,
		false, // includeIdle
		false, // idleByNode
		false, // includeProportionalAssetResourceCosts
		false, // includeAggregatedMetadata
		false, // sharedLoadBalancer
		opencost.AccumulateOptionNone,
		false, // shareIdle
		filterString,
	)
	if err != nil {
		proto.WriteError(w, proto.InternalServerError(fmt.Sprintf("Failed to query allocations: %s", err)))
		return
	}

	// Handle empty results
	if asr == nil || len(asr.Allocations) == 0 {
		WriteData(w, &EfficiencyResponse{Efficiencies: []*EfficiencyMetric{}}, nil)
		return
	}

	// Compute efficiency metrics from allocations using concurrent processing
	var (
		mu           sync.Mutex
		wg           sync.WaitGroup
		efficiencies = make([]*EfficiencyMetric, 0)
	)

	for _, allocSet := range asr.Allocations {
		if allocSet == nil {
			continue
		}

		wg.Add(1)
		go func(allocSet *opencost.AllocationSet) {
			defer wg.Done()

			localMetrics := make([]*EfficiencyMetric, 0, len(allocSet.Allocations))
			for _, alloc := range allocSet.Allocations {
				if metric := ComputeEfficiencyMetric(alloc, bufferMultiplier); metric != nil {
					localMetrics = append(localMetrics, metric)
				}
			}

			if len(localMetrics) > 0 {
				mu.Lock()
				efficiencies = append(efficiencies, localMetrics...)
				mu.Unlock()
			}
		}(allocSet)
	}

	wg.Wait()

	WriteData(w, &EfficiencyResponse{Efficiencies: efficiencies}, nil)
}
