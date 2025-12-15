import { world, system } from "@minecraft/server";

/**
 * Modular function to detect all players with the "dragonRider" tag
 * Can be reused in other scripts by importing this function
 * @returns {Player[]} Array of players with the "dragonRider" tag
 */
export function detectDragonRiders() {
    try {
        const dragonRiders = [];
        const allPlayers = world.getAllPlayers();
        
        for (const player of allPlayers) {
            if (player.hasTag("dragonRider")) {
                console.log(`${player.name} detected`);
                dragonRiders.push(player);
            }
        }
        
        return dragonRiders;
    } catch (error) {
        console.warn("Error detecting dragon riders:", error);
        return [];
    }
}

/**
 * Check if a block is solid/not passable
 * @param {Block} block - The block to check
 * @returns {boolean} True if block is solid, false otherwise
 */
function isSolidBlock(block) {
    if (!block) return false;
    
    // List of non-solid/passable blocks
    const nonSolidBlocks = [
        "minecraft:air",
        "minecraft:water",
        "minecraft:flowing_water",
        "minecraft:lava",
        "minecraft:flowing_lava",
        "minecraft:barrier",
        "minecraft:light_block",
        "minecraft:light_block_0",
        "minecraft:light_block_1",
        "minecraft:light_block_2",
        "minecraft:light_block_3",
        "minecraft:light_block_4",
        "minecraft:light_block_5",
        "minecraft:light_block_6",
        "minecraft:light_block_7",
        "minecraft:light_block_8",
        "minecraft:light_block_9",
        "minecraft:light_block_10",
        "minecraft:light_block_11",
        "minecraft:light_block_12",
        "minecraft:light_block_13",
        "minecraft:light_block_14",
        "minecraft:light_block_15",
    ];
    
    // Check if block is in non-solid list
    if (nonSolidBlocks.includes(block.typeId)) {
        return false;
    }
    
    // Check if block is solid using the isSolid property
    try {
        return block.isSolid;
    } catch (error) {
        // Fallback: assume it's solid if not in non-solid list
        return true;
    }
}

/**
 * Check for solid blocks in a 4-block radius around player at same Y level or below
 * @param {Player} player - The player to check around
 * @returns {Object} Object with solidBlocksFound array and nearest distance
 */
function checkSolidBlocksAround(player) {
    try {
        const playerLocation = player.location;
        const dimension = player.dimension;
        const searchRadius = 4;
        const solidBlocks = [];
        let nearestDistance = Infinity;
        
        // Check blocks in a radius around the player
        for (let x = -searchRadius; x <= searchRadius; x++) {
            for (let z = -searchRadius; z <= searchRadius; z++) {
                // Check at player's Y level and below
                for (let y = 0; y >= -searchRadius; y--) {
                    const checkLocation = {
                        x: Math.floor(playerLocation.x) + x,
                        y: Math.floor(playerLocation.y) + y,
                        z: Math.floor(playerLocation.z) + z
                    };
                    
                    try {
                        const block = dimension.getBlock(checkLocation);
                        if (block && isSolidBlock(block)) {
                            const distance = Math.sqrt(x * x + z * z);
                            solidBlocks.push({
                                location: checkLocation,
                                block: block,
                                distance: distance
                            });
                            
                            if (distance < nearestDistance) {
                                nearestDistance = distance;
                            }
                        }
                    } catch (blockError) {
                        // Block outside world bounds, skip
                        continue;
                    }
                }
            }
        }
        
        return {
            solidBlocksFound: solidBlocks,
            nearestDistance: nearestDistance,
            hasSolidBlocks: solidBlocks.length > 0
        };
    } catch (error) {
        console.warn("Error checking solid blocks around player:", error);
        return {
            solidBlocksFound: [],
            nearestDistance: Infinity,
            hasSolidBlocks: false
        };
    }
}

/**
 * Storage for tracking player states (before/after conditions)
 * Key: player.name, Value: { hadSolidBlockBefore: boolean }
 */
const playerStates = new Map();

/**
 * Detect transitions in solid block presence below player
 * Tracks "before" and "after" conditions:
 * - BEFORE: No solid block below → Solid block appears below
 * - AFTER: Solid block below → No solid block below
 * 
 * @param {Player} player - The player to check
 * @returns {Object} Object with transition state and block info
 */
export function detectSolidBlockTransition(player) {
    try {
        const playerName = player.name;
        const currentBlockData = checkSolidBlocksAround(player);
        const hasSolidBlockNow = currentBlockData.hasSolidBlocks;
        
        // Get previous state (default to false if new player)
        const previousState = playerStates.get(playerName) || { hadSolidBlockBefore: false };
        const hadSolidBlockBefore = previousState.hadSolidBlockBefore;
        
        // Determine transition type
        let transitionType = "none";
        
        if (!hadSolidBlockBefore && hasSolidBlockNow) {
            // BEFORE condition: No solid block → Solid block appeared
            transitionType = "before";
        } else if (hadSolidBlockBefore && !hasSolidBlockNow) {
            // AFTER condition: Solid block → No solid block (flying/falling)
            transitionType = "after";
        }
        
        // Update player state
        playerStates.set(playerName, { hadSolidBlockBefore: hasSolidBlockNow });
        
        return {
            player: player,
            transitionType: transitionType,
            hasSolidBlockNow: hasSolidBlockNow,
            hadSolidBlockBefore: hadSolidBlockBefore,
            blockData: currentBlockData,
            // Helper flags for easy condition checking
            isBeforeCondition: transitionType === "before",
            isAfterCondition: transitionType === "after",
            isStable: transitionType === "none"
        };
    } catch (error) {
        console.warn(`Error detecting solid block transition for player ${player.name}:`, error);
        return {
            player: player,
            transitionType: "error",
            hasSolidBlockNow: false,
            hadSolidBlockBefore: false,
            blockData: null,
            isBeforeCondition: false,
            isAfterCondition: false,
            isStable: false
        };
    }
}

/**
 * Main function executed every 3 ticks
 * Detects dragon riders and checks for solid block transitions
 */
function dragonRiderTick() {
    try {
        // Get all players with "dragonRider" tag
        const dragonRiders = detectDragonRiders();
        
        if (dragonRiders.length === 0) {
            return; // No dragon riders to process
        }
        
        // Process each dragon rider
        for (const rider of dragonRiders) {
            // Detect solid block transitions for this rider
            const transitionData = detectSolidBlockTransition(rider);
            
            // Handle BEFORE condition: Landing on solid ground
            if (transitionData.isBeforeCondition) {
                // Player just landed on solid ground
                // Add your custom logic here
                // Example: Play landing sound, trigger event, etc.
                console.log(`${rider.name} landed on solid ground (BEFORE condition)`);
                
                // Optional: Send feedback to player
                // rider.onScreenDisplay.setActionBar("§aLanded on ground");
            }
            
            // Handle AFTER condition: Taking off from solid ground
            if (transitionData.isAfterCondition) {
                // Player just left solid ground (flying/falling)
                // Add your custom logic here
                // Example: Play takeoff sound, trigger event, etc.
                console.log(`${rider.name} left solid ground (AFTER condition)`);
                
                // Optional: Send feedback to player
                // rider.onScreenDisplay.setActionBar("§eAirborne!");
            }
            
            // Optional: Log stable states for debugging
            if (transitionData.isStable) {
                // No transition, rider is stable (either on ground or in air)
                // You can add continuous effects here if needed
            }
            
            // Access detailed block data if needed
            if (transitionData.blockData && transitionData.blockData.hasSolidBlocks) {
                const nearestBlock = transitionData.blockData.solidBlocksFound[0];
                // Do something with nearest solid block data
            }
        }
    } catch (error) {
        console.warn("Error in dragonRiderTick:", error);
    }
}

/**
 * Initialize the Dragon rider system
 * Starts the 3-tick interval for detecting riders and solid blocks
 */
function initializeDragonSystem() {
    console.log("Dragon rider system initialized - Running every 3 ticks");
    
    // Run the tick function every 3 ticks
    system.runInterval(() => {
        dragonRiderTick();
    }, 3);
}

// Auto-initialize when script loads
initializeDragonSystem();

