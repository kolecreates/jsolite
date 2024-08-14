import type { Subprocess } from "bun";
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { rm } from "node:fs/promises";
describe("Concurrency", () => {
  let processes: Subprocess[];


  afterAll(async () => {
    for (const process of processes) {
      process.kill();
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await rm("./concurrency-test.db").catch(() => {});
    await rm("./concurrency-test.db-journal").catch(() => {});
    await rm("./concurrency-test.db-wal").catch(() => {});
    await rm("./concurrency-test.db-shm").catch(() => {});
  });

  test("POST, GET, PATCH, DELETE todos", async () => {
    processes = [];
    const processCount = 2;
    for (let i = 0; i < processCount; i++) {
      processes.push(Bun.spawn(["bun", "./tests/concurrency-test-server.ts"], {
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          DB_NAME: "./concurrency-test.db",
          PORT: (3000 + i).toString(),
        }
      })
      );
    }
    let attempts = 0;
    const checkHealth = async (port: number) => {
      let status;
      while ((status = await fetch(`http://localhost:${port}/healthcheck`).then((res) => res.status).catch(() => 500)) !== 200) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        attempts++;
        if (attempts > 20) {
          throw new Error(`Server on port ${port} failed to start`);
        }
      }
    };

    await Promise.all(Array.from({ length: processCount }, (_, i) => checkHealth(3000 + i)));
   
    const iterations = 10_000;
    const batchSize = 10;
    console.time("inc");
    for (let i = 0; i < iterations; i+=batchSize) {
      let promises = [];
      for (let j = 0; j < batchSize; j++) {
        const port = 3000 + (j % processCount);
        //const port = 3000;
         promises.push(fetch(`http://localhost:${port}/inc`, {
           method: "POST",
           body: JSON.stringify({ key: "test" }),
         }));
      }
      await Promise.all(promises);
      promises = [];
    }
    console.timeEnd("inc");
    const res = await (await fetch(`http://localhost:${3000}/inc`, {
      method: "POST",
      body: JSON.stringify({ key: "test" }),
    })).json();
    console.log(res);
    expect(res.count).toEqual(iterations + 1);
  });
});
