import client from "./api_client";

class EfficiencyService {
  async fetchEfficiency(win, aggregate, options = {}) {
    const { buffer, filter, minSavings, minSavingsPercent } = options;
    const params = {
      window: win,
      aggregate: aggregate,
    };
    if (buffer) {
      params.buffer = buffer;
    }
    if (filter) {
      params.filter = filter;
    }
    if (minSavings !== undefined) {
      params.minSavings = minSavings;
    }
    if (minSavingsPercent !== undefined) {
      params.minSavingsPercent = minSavingsPercent;
    }

    const result = await client.get("/allocation/efficiency", { params });
    return result.data;
  }
}

export default new EfficiencyService();
