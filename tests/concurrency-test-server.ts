import jsolite from "../index";
import { join } from "path";


const db = jsolite(join(process.cwd(), "concurrency-test.db"));

const counters = db.map<string, number>("counters");


const server =Bun.serve({
    port: Number(process.env.PORT),
    fetch: async (req, res) => {
        const url = new URL(req.url);
        if (url.pathname === "/healthcheck") {
            return Response.json({ message: "OK" });
        } else if (url.pathname === "/inc" && req.method === "POST") {
            const { key } = await req.json();
            const count = db.transaction(() => {
                const count = counters.get(key) ?? 0;
                counters.set(key, count + 1);
                return count + 1;
            });
            return Response.json({ count });
        } else if (url.pathname === "/counter" && req.method === "GET") {
            const key = url.searchParams.get("name")!;
            return Response.json({ count: counters.get(key) ?? 0 });
        }

        return new Response("Not found", { status: 404 });
    },
    
});


["exit", "SIGTERM", "SIGINT", "SIGKILL"].forEach((signal) => {
    process.on(signal, () => {
        db.close();
        process.exit(0);
    });
});

console.log(`HTTP Server running at http://localhost:${server.port}`);
