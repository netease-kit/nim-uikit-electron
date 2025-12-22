// import { t } from "./i18n";
import dayjs from "dayjs";

export const formatDateRange = (type: string | number) => {
  const date = new Date();
  let year = date.getFullYear();
  let month: string | number = date.getMonth() + 1;
  let day: string | number = date.getDate();

  if (type === "start") {
    year = year - 100;
  } else if (type === "end") {
    year = year;
  }
  month = month > 9 ? month : "0" + month;
  day = day > 9 ? day : "0" + day;
  return `${year}-${month}-${day}`;
};

export const formatDate = (time: string | number | undefined) => {
  if (time === undefined || time === null || time === "") {
    return "";
  }

  let d: dayjs.Dayjs;

  if (typeof time === "string") {
    const s = time.trim();
    if (!s) {
      return "";
    }
    if (/^[0-9]+$/.test(s)) {
      const t = Number(s);
      if (t >= 946684800000 && t <= 4102444800000) {
        d = dayjs(t);
      } else if (t >= 946684800 && t <= 4102444800) {
        d = dayjs(t * 1000);
      } else if (t >= 100001 && t <= 999912) {
        const year = Math.floor(t / 100);
        const month = t % 100;
        d = dayjs(new Date(year, month - 1, 1));
      } else if (t >= 10000101 && t <= 99991231) {
        const year = Math.floor(t / 10000);
        const month = Math.floor((t % 10000) / 100);
        const day = t % 100;
        d = dayjs(new Date(year, month - 1, day));
      } else {
        const len = s.length;
        d = dayjs(len >= 13 ? t : t * 1000);
      }
    } else {
      d = dayjs(s);
    }
  } else {
    const t = Number(time);
    if (t >= 946684800000 && t <= 4102444800000) {
      d = dayjs(t);
    } else if (t >= 946684800 && t <= 4102444800) {
      d = dayjs(t * 1000);
    } else if (t >= 100001 && t <= 999912) {
      const year = Math.floor(t / 100);
      const month = t % 100;
      d = dayjs(new Date(year, month - 1, 1));
    } else if (t >= 10000101 && t <= 99991231) {
      const year = Math.floor(t / 10000);
      const month = Math.floor((t % 10000) / 100);
      const day = t % 100;
      d = dayjs(new Date(year, month - 1, day));
    } else {
      const len = String(Math.floor(Math.abs(t))).length;
      d = dayjs(len >= 13 ? t : t * 1000);
    }
  }

  const isCurrentDay = d.isSame(dayjs(), "day");
  const isCurrentYear = d.isSame(dayjs(), "year");
  return d.format(isCurrentDay ? "HH:mm" : isCurrentYear ? "MM-DD" : "YYYY-MM");
};
