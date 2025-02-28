import { customType } from "drizzle-orm/pg-core";

export const vector = <D extends number>(name: string, dimensions: D) =>
  customType<{ data: number[]; driverData: string }>({
    name: "vector",
    dataType() {
      return `vector(${dimensions})`;
    },
    toDriver(value: number[]): string {
      return `[${value.join(",")}]`;
    },
    fromDriver(value: string): number[] {
      return value.slice(1, -1).split(",").map(Number);
    },
  });
