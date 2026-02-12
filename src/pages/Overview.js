import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import RefreshIcon from "@mui/icons-material/Refresh";

import Header from "../components/Header";
import Page from "../components/Page";
import Footer from "../components/Footer";
import Warnings from "../components/Warnings";
import SummaryCards from "../components/overview/SummaryCards";
import TopCostDrivers from "../components/overview/TopCostDrivers";
import AllocationService from "../services/allocation";
import EfficiencyService from "../services/efficiency";
import { rangeToCumulative, cumulativeToTotals } from "../util";

function computePriorWindow() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);

  const fmt = (d) => d.toISOString().split(".")[0] + "Z";
  return `${fmt(fourteenDaysAgo)},${fmt(sevenDaysAgo)}`;
}

const OverviewPage = () => {
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [currentCumulative, setCurrentCumulative] = useState({});
  const [priorCumulative, setPriorCumulative] = useState({});
  const [totalData, setTotalData] = useState({});
  const [priorTotalData, setPriorTotalData] = useState({});
  const [efficiencyData, setEfficiencyData] = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setErrors([]);

    const priorWindow = computePriorWindow();

    try {
      const [currentResp, priorResp, effResp] = await Promise.all([
        AllocationService.fetchAllocation("7d", "namespace", {
          accumulate: true,
          includeIdle: false,
        }),
        AllocationService.fetchAllocation(priorWindow, "namespace", {
          accumulate: true,
          includeIdle: false,
        }).catch(() => null),
        EfficiencyService.fetchEfficiency("7d", "namespace").catch(() => null),
      ]);

      if (currentResp?.data?.length > 0) {
        const cum = rangeToCumulative(currentResp.data, "namespace");
        setCurrentCumulative(cum || {});
        setTotalData(cumulativeToTotals(cum));
      } else {
        setCurrentCumulative({});
        setTotalData({});
      }

      if (priorResp?.data?.length > 0) {
        const cum = rangeToCumulative(priorResp.data, "namespace");
        setPriorCumulative(cum || {});
        setPriorTotalData(cumulativeToTotals(cum));
      } else {
        setPriorCumulative({});
        setPriorTotalData({});
      }

      if (effResp?.data?.efficiencies) {
        setEfficiencyData(effResp.data.efficiencies);
      } else {
        setEfficiencyData([]);
      }
    } catch (err) {
      let secondary = "Please open an Issue on GitHub if problems persist.";
      if (err.message && err.message.length > 0) {
        secondary = err.message;
      }
      setErrors([{ primary: "Failed to load overview data", secondary }]);
    }

    setLoading(false);
  }

  // Compute summary metrics
  const totalSpend = totalData.totalCost || 0;
  const priorSpend = priorTotalData.totalCost || 0;

  // Compute weighted efficiency from efficiency data
  let clusterEfficiency = totalData.totalEfficiency || 0;
  let totalSavings = 0;

  if (efficiencyData.length > 0) {
    let totalCost = 0;
    let weightedEff = 0;

    efficiencyData.forEach((item) => {
      totalSavings += item.costSavings || 0;
      const itemCost = item.currentTotalCost || 0;
      const itemCpuCost = item.cpuCost || 0;
      const itemRamCost = item.ramCost || 0;
      const computeCost = itemCpuCost + itemRamCost;

      if (computeCost > 0) {
        const eff =
          (itemCpuCost * (item.cpuEfficiency || 0) +
            itemRamCost * (item.memoryEfficiency || 0)) /
          computeCost;
        totalCost += computeCost;
        weightedEff += computeCost * eff;
      }
    });

    if (totalCost > 0) {
      clusterEfficiency = weightedEff / totalCost;
    }
  }

  function handleRowClick(name) {
    navigate(`/allocation?agg=namespace&filter=namespace:"${encodeURIComponent(name)}"`);
  }

  return (
    <Page>
      <Header headerTitle="Overview">
        <IconButton aria-label="refresh" onClick={() => fetchData()} style={{ padding: 12 }}>
          <RefreshIcon />
        </IconButton>
      </Header>

      {!loading && errors.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <Warnings warnings={errors} />
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ paddingTop: 100, paddingBottom: 100 }}>
            <CircularProgress />
          </div>
        </div>
      )}

      {!loading && (
        <>
          <SummaryCards
            totalSpend={totalSpend}
            priorSpend={priorSpend}
            efficiency={clusterEfficiency}
            savings={totalSavings}
          />
          <TopCostDrivers
            currentData={currentCumulative}
            priorData={priorCumulative}
            efficiencyData={efficiencyData}
            onRowClick={handleRowClick}
          />
        </>
      )}

      <Footer />
    </Page>
  );
};

export default React.memo(OverviewPage);
