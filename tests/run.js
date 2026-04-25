const { spawn } = require("node:child_process");
const path = require("node:path");

const root = __dirname ? path.resolve(__dirname, "..") : process.cwd();
const child = spawn(
  process.execPath,
  [
    "--loader",
    path.join(root, "tests/stripe-loader.mjs"),
    path.join(root, "tests/integration.mjs")
  ],
  {
    cwd: root,
    stdio: "inherit"
  }
);

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
