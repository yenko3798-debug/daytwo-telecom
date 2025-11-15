import { spawn } from "child_process";
import { createHash, randomUUID } from "crypto";
import { once } from "events";
export function runCommand(command, args = []) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: "inherit" });
        child.on("error", reject);
        child.on("exit", (code) => {
            if (code === 0)
                resolve();
            else
                reject(new Error(`${command} exited with code ${code}`));
        });
    });
}
export function hashKey(input) {
    return createHash("sha256").update(input).digest("hex");
}
export function newId(prefix) {
    return `${prefix}-${randomUUID()}`;
}
export async function waitForEvent(emitter, success, failure) {
    if (failure) {
        const result = await Promise.race([
            once(emitter, success),
            once(emitter, failure).then(([event]) => {
                throw event;
            }),
        ]);
        return result;
    }
    return once(emitter, success);
}
