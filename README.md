# jsolite

synchronous javascript object syntax over sqlite. currently only works with the bun runtime.


## Get Started

```bash
bun install
```


```ts
import jsolite from 'jsolite';

const db = jsolite(":memory:");
const todos = db.array("todos");

todos.push("eat dinner", "go for a run", "clean room");

console.log(todos.at(0)); // "eat dinner"

todos.splice(1, 1); // Removes "go for a run"

const filteredTodos = todos.filter((todo) => todo.includes("eat"));

console.log(filteredTodos.toJsArray()); // [ "eat dinner" ]

const users = db.map("users");

users.set("joe", { name: "Joe", age: 30 });

console.log(users.get("joe")); // { name: "Joe", age: 30 }

const config = db.record("config");

config.systemOnline = true;
config.cache = {};

console.log(config.systemOnline); // true

delete config.cache;

const listArrays = db.listArrays();
const listMaps = db.listMaps();
const listRecords = db.listRecords();

console.log(listArrays); // [ { name: "todos" } ]
console.log(listMaps); // [ { name: "users" } ]
console.log(listRecords); // [ { name: "config" } ]

//... and more
```


To run tests:

```bash
bun test
```