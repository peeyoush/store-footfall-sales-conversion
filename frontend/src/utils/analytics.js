import { parseNumber } from "./formatters";

export function calculateStats(rows) {
  if (!rows.length) {
    return null;
  }

  const usableRows = rows.filter(
    (row) => row.sensor_ok
  );

  const totalVisitors = usableRows.reduce(
    (sum, row) =>
      sum + parseNumber(row.footfall),
    0
  );

  const totalBills = rows.reduce(
    (sum, row) =>
      sum + parseNumber(row.bills),
    0
  );

  const totalRevenue = rows.reduce(
    (sum, row) =>
      sum + parseNumber(row.revenue),
    0
  );

  const measurableBills = usableRows.reduce(
    (sum, row) =>
      sum + parseNumber(row.bills),
    0
  );

  const overallConversion =
    totalVisitors > 0
      ? measurableBills / totalVisitors
      : 0;

  const hourlyMap = {};

  usableRows.forEach((row) => {
    if (!hourlyMap[row.hour]) {
      hourlyMap[row.hour] = {
        hour: row.hour,
        visitors: 0,
        bills: 0,
      };
    }

    hourlyMap[row.hour].visitors +=
      parseNumber(row.footfall);

    hourlyMap[row.hour].bills +=
      parseNumber(row.bills);
  });

  const hourly = Object.values(hourlyMap)
    .map((item) => ({
      ...item,
      conversion:
        item.visitors > 0
          ? item.bills / item.visitors
          : 0,
    }))
    .sort((a, b) => a.hour - b.hour);

  const worstHours = [...hourly]
    .sort(
      (a, b) =>
        a.conversion - b.conversion
    )
    .slice(0, 3);

  const storeMap = {};

  usableRows.forEach((row) => {
    if (!storeMap[row.store_id]) {
      storeMap[row.store_id] = {
        store_id: row.store_id,
        city: row.city,
        format: row.format,
        visitors: 0,
        bills: 0,
        revenue: 0,
      };
    }

    storeMap[row.store_id].visitors +=
      parseNumber(row.footfall);

    storeMap[row.store_id].bills +=
      parseNumber(row.bills);

    storeMap[row.store_id].revenue +=
      parseNumber(row.revenue);
  });

  const stores = Object.values(storeMap)
    .map((store) => ({
      ...store,
      conversion:
        store.visitors > 0
          ? store.bills / store.visitors
          : 0,
    }))
    .sort(
      (a, b) =>
        b.conversion - a.conversion
    );

  const dailyMap = {};

  usableRows.forEach((row) => {
    const key =
      `${row.store_id}_${row.trade_date}`;

    if (!dailyMap[key]) {
      dailyMap[key] = {
        store_id: row.store_id,
        trade_date: row.trade_date,
        footfall: 0,
        bills: 0,
      };
    }

    dailyMap[key].footfall +=
      parseNumber(row.footfall);

    dailyMap[key].bills +=
      parseNumber(row.bills);
  });

  const daysByStore = {};

  Object.values(dailyMap).forEach((day) => {
    if (!daysByStore[day.store_id]) {
      daysByStore[day.store_id] = [];
    }

    daysByStore[day.store_id].push(day);
  });

  const decileMap = {};

  Object.values(daysByStore).forEach((days) => {
    days.sort(
      (a, b) =>
        a.footfall - b.footfall
    );

    days.forEach((day, index) => {
      const decile = Math.min(
        10,
        Math.floor(
          (index * 10) / days.length
        ) + 1
      );

      if (!decileMap[decile]) {
        decileMap[decile] = {
          decile,
          visitors: 0,
          bills: 0,
        };
      }

      decileMap[decile].visitors +=
        day.footfall;

      decileMap[decile].bills +=
        day.bills;
    });
  });

  const deciles = Object.values(decileMap)
    .map((item) => ({
      ...item,
      conversion:
        item.visitors > 0
          ? item.bills / item.visitors
          : 0,
    }))
    .sort(
      (a, b) =>
        a.decile - b.decile
    );

  return {
    totalVisitors,
    totalBills,
    totalRevenue,
    overallConversion,
    hourly,
    worstHours,
    stores,
    deciles,
    usableRows: usableRows.length,
    unknownRows:
      rows.length - usableRows.length,
  };
}