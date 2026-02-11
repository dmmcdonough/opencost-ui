import client from "./api_client";

class EfficiencyService {
  async fetchEfficiency(win, aggregate, options = {}) {
    const { buffer, filter } = options;
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

    const result = await client.get("/allocation/efficiency", { params });
    return result.data;
  }
}

export default new EfficiencyService();
