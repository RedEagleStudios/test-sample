import { system, world } from "@minecraft/server";

// This will print Hello world every 20 seconds
system.runInterval(() => {
    world.sendMessage("Hello, world!");
}, secondToTick(5));

// Convert second to tick, 1 tick in minecraft is 0.05 second. 20 ticks = 1 second
function secondToTick(second: number) {
    return second * 20
}