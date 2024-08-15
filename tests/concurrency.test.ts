import type { Subprocess } from "bun";
import { describe, expect, test, afterEach } from "bun:test";
import { rm } from "node:fs/promises";


describe.skip("Concurrency", () => {
  let processes: Subprocess[];

  async function spawnProcesses(processCount: number) {
    processes = [];
    for (let i = 0; i < processCount; i++) {
      processes.push(
        Bun.spawn(["bun", "./tests/concurrency-test-server.ts"], {
          stdout: "pipe",
          stderr: "pipe",
          env: {
            ...process.env,
            DB_NAME: "./concurrency-test.db",
            PORT: (3000 + i).toString(),
          },
        })
      );
    }
    let attempts = 0;
    const checkHealth = async (port: number) => {
      let status;
      while (
        (status = await fetch(`http://localhost:${port}/healthcheck`)
          .then((res) => res.status)
          .catch(() => 500)) !== 200
      ) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        attempts++;
        if (attempts > 20) {
          throw new Error(`Server on port ${port} failed to start`);
        }
      }
    };

    await Promise.all(
      Array.from({ length: processCount }, (_, i) => checkHealth(3000 + i))
    );
  }

  afterEach(async () => {
    for (const process of processes) {
      process.kill();
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await rm("./concurrency-test.db").catch(() => {});
    await rm("./concurrency-test.db-journal").catch(() => {});
    await rm("./concurrency-test.db-wal").catch(() => {});
    await rm("./concurrency-test.db-shm").catch(() => {});
  });

  test("writes", async () => {
    const iterations = 10_000;
    const batchSize = 10;
    const processCount = 2;
    await spawnProcesses(processCount);
    console.time("writes");
    for (let i = 0; i < iterations; i += batchSize) {
      let promises = [];
      for (let j = 0; j < batchSize; j++) {
        const port = 3000 + (j % processCount);
        promises.push(
          fetch(`http://localhost:${port}/inc`, {
            method: "POST",
            body: JSON.stringify({ key: "test" }),
          })
        );
      }
      await Promise.all(promises);
      promises = [];
    }
    console.timeEnd("writes");
    const res = await (
      await fetch(`http://localhost:${3000}/inc`, {
        method: "POST",
        body: JSON.stringify({ key: "test" }),
      })
    ).json();
    expect(res.count).toEqual(iterations + 1);
  });

  test("reads", async () => {
    const iterations = 10_000;
    const batchSize = 20;
    const processCount = 3;
    await spawnProcesses(processCount);
    console.time("reads");
    for (let i = 0; i < iterations; i += batchSize) {
      let promises = [];
      for (let j = 0; j < batchSize; j++) {
        const port = 3000 + (j % processCount);
        promises.push(
          fetch(`http://localhost:${port}/counter?name=test`, {
            method: "GET",
          })
        );
      }
      await Promise.all(promises);
      promises = [];
    }
    console.timeEnd("reads");
  });

  test("reads and writes", async () => {
    const iterations = 10_000;
    const batchSize = 10;
    const processCount = 3;
    await spawnProcesses(processCount);
    console.time("reads and writes");
    for (let i = 0; i < iterations; i++) {
      let promises = [];
      promises.push(
        fetch(`http://localhost:${3000}/inc`, {
          method: "POST",
          body: JSON.stringify({ key: "test" }),
        })
      );
      const port = 3000 + (i % processCount);
      promises.push(
        fetch(`http://localhost:${port}/counter?name=test`, {
          method: "GET",
        })
      );
      if (i % batchSize === 0) {
        await Promise.all(promises);
        promises = [];
      }
    }
    console.timeEnd("reads and writes");
    const res = await (
      await fetch(`http://localhost:${3000}/inc`, {
        method: "POST",
        body: JSON.stringify({ key: "test" }),
      })
    ).json();
    expect(res.count).toEqual(iterations + 1);
  });

});
