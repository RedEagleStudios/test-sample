import { system, world } from "@minecraft/server";

system.runInterval(() => {
    world.sendMessage("Hello, world!");
}, secondToTick(5));

function secondToTick(second: number) {
    return second * 20
}