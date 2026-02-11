package costmodel

import (
	"testing"
	"time"

	"github.com/opencost/opencost/core/pkg/opencost"
)

func TestSafeDiv(t *testing.T) {
	tests := []struct {
		name        string
		numerator   float64
		denominator float64
		expected    float64
	}{
		{"normal division", 10.0, 2.0, 5.0},
		{"zero denominator", 10.0, 0.0, 0.0},
		{"zero numerator", 0.0, 2.0, 0.0},
		{"both zero", 0.0, 0.0, 0.0},
		{"negative values", -10.0, 2.0, -5.0},
		{"fractional result", 5.0, 2.0, 2.5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SafeDiv(tt.numerator, tt.denominator)
			if result != tt.expected {
				t.Errorf("SafeDiv(%v, %v) = %v, want %v", tt.numerator, tt.denominator, result, tt.expected)
			}
		})
	}
}

func TestComputeEfficiencyMetric_Nil(t *testing.T) {
	result := ComputeEfficiencyMetric(nil, 1.2)
	if result != nil {
		t.Errorf("expected nil for nil allocation, got %v", result)
	}
}

func TestComputeEfficiencyMetric_ZeroHours(t *testing.T) {
	now := time.Now()
	alloc := &opencost.Allocation{
		Name:  "test-pod",
		Start: now,
		End:   now, // 0 minutes
	}

	result := ComputeEfficiencyMetric(alloc, 1.2)
	if result != nil {
		t.Errorf("expected nil for zero-duration allocation, got %v", result)
	}
}

func TestComputeEfficiencyMetric_Basic(t *testing.T) {
	now := time.Now()
	alloc := &opencost.Allocation{
		Name:                   "test-ns",
		Start:                  now.Add(-24 * time.Hour),
		End:                    now,
		CPUCoreHours:           24.0,   // 1 core avg
		RAMByteHours:           24.0e9, // 1GB avg
		CPUCoreRequestAverage:  2.0,
		RAMBytesRequestAverage: 2.0e9,
		CPUCost:                10.0,
		RAMCost:                5.0,
	}

	result := ComputeEfficiencyMetric(alloc, 1.2)
	if result == nil {
		t.Fatal("expected non-nil result")
	}

	if result.Name != "test-ns" {
		t.Errorf("Name = %q, want %q", result.Name, "test-ns")
	}
	if result.CPUEfficiency != 0.5 {
		t.Errorf("CPUEfficiency = %v, want 0.5", result.CPUEfficiency)
	}
	if result.MemoryEfficiency != 0.5 {
		t.Errorf("MemoryEfficiency = %v, want 0.5", result.MemoryEfficiency)
	}
	if result.RecommendedCPURequest != 1.2 {
		t.Errorf("RecommendedCPURequest = %v, want 1.2", result.RecommendedCPURequest)
	}
	if result.RecommendedRAMRequest != 1.2e9 {
		t.Errorf("RecommendedRAMRequest = %v, want 1.2e9", result.RecommendedRAMRequest)
	}
	if result.CostSavings <= 0 {
		t.Errorf("CostSavings = %v, want > 0", result.CostSavings)
	}
	if result.EfficiencyBufferMultiplier != 1.2 {
		t.Errorf("EfficiencyBufferMultiplier = %v, want 1.2", result.EfficiencyBufferMultiplier)
	}
}

func TestComputeEfficiencyMetric_MinThresholds(t *testing.T) {
	now := time.Now()
	alloc := &opencost.Allocation{
		Name:                   "tiny-pod",
		Start:                  now.Add(-24 * time.Hour),
		End:                    now,
		CPUCoreHours:           0.00001,
		RAMByteHours:           100,
		CPUCoreRequestAverage:  0.1,
		RAMBytesRequestAverage: 1000,
		CPUCost:                0.001,
		RAMCost:                0.001,
	}

	result := ComputeEfficiencyMetric(alloc, 1.2)
	if result == nil {
		t.Fatal("expected non-nil result")
	}

	if result.RecommendedCPURequest != EfficiencyMinCPU {
		t.Errorf("RecommendedCPURequest = %v, want %v", result.RecommendedCPURequest, EfficiencyMinCPU)
	}
	if result.RecommendedRAMRequest != EfficiencyMinRAM {
		t.Errorf("RecommendedRAMRequest = %v, want %v", result.RecommendedRAMRequest, EfficiencyMinRAM)
	}
}
