import { world, system } from "@minecraft/server";

/**
 * Modular function to detect all dragons (re_dra:dragon entities)
 * Can be reused in other scripts by importing this function
 * @returns {Entity[]} Array of dragon entities
 */
export function detectDragons() {
    try {
        const dragons = [];
        
        // Get all dragons from all dimensions
        for (const dimension of [world.getDimension("overworld"), world.getDimension("nether"), world.getDimension("the_end")]) {
            try {
                const dimensionDragons = dimension.getEntities({
                    type: "re_dra:dragon"
                });
                dragons.push(...dimensionDragons);
            } catch (error) {
                // Dimension not available, skip
                continue;
            }
        }
        
        return dragons;
    } catch (error) {
        console.warn("Error detecting dragons:", error);
        return [];
    }
}

/**
 * Check if a block is solid/not passable
 * @param {Block} block - The block to check
 * @returns {boolean} True if block is solid, false otherwise
 */
export function isSolidBlock(block) {
    if (!block) return false;
    
    // List of non-solid/passable blocks that players can pass through
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
        "minecraft:tall_grass",
        "minecraft:short_grass",
        "minecraft:fern",
        "minecraft:large_fern",
        "minecraft:seagrass",
        "minecraft:kelp",
        "minecraft:torch",
        "minecraft:soul_torch",
        "minecraft:redstone_torch",
        "minecraft:fire",
        "minecraft:soul_fire",
        "minecraft:snow",
        "minecraft:rail",
        "minecraft:golden_rail",
        "minecraft:detector_rail",
        "minecraft:activator_rail",
        "minecraft:powered_rail",
        "minecraft:lever",
        "minecraft:redstone_wire",
        "minecraft:tripwire",
        "minecraft:tripwire_hook",
        "minecraft:stone_pressure_plate",
        "minecraft:wooden_pressure_plate",
        "minecraft:light_weighted_pressure_plate",
        "minecraft:heavy_weighted_pressure_plate",
        "minecraft:crimson_pressure_plate",
        "minecraft:warped_pressure_plate",
        "minecraft:acacia_pressure_plate",
        "minecraft:birch_pressure_plate",
        "minecraft:dark_oak_pressure_plate",
        "minecraft:jungle_pressure_plate",
        "minecraft:oak_pressure_plate",
        "minecraft:spruce_pressure_plate",
        "minecraft:mangrove_pressure_plate",
        "minecraft:bamboo_pressure_plate",
        "minecraft:cherry_pressure_plate",
    ];
    
    // If block is in non-solid list, it's not solid
    if (nonSolidBlocks.includes(block.typeId)) {
        return false;
    }
    
    // Everything else is considered solid (stone, dirt, gravel, etc.)
    return true;
}

/**
 * Check for solid blocks directly below the entity (dragon)
 * @param {Entity} entity - The entity to check
 * @param {number} maxDistance - Maximum distance to check below (default: 4)
 * @returns {Object} Object with solidBlockFound boolean and block data
 */
export function checkSolidBlockBelow(entity, maxDistance = 4) {
    try {
        const entityLocation = entity.location;
        const dimension = entity.dimension;
        
        // Check blocks directly below the entity
        // Start from Y=0 (entity's feet level) down to Y=-maxDistance
        for (let y = 0; y >= -maxDistance; y--) {
            const checkLocation = {
                x: Math.floor(entityLocation.x),
                y: Math.floor(entityLocation.y) + y,
                z: Math.floor(entityLocation.z)
            };
            
            try {
                const block = dimension.getBlock(checkLocation);
                console.log(`  Checking Y=${checkLocation.y} (offset ${y}): ${block?.typeId} | isSolid: ${block ? isSolidBlock(block) : 'null'}`);
                
                if (block && isSolidBlock(block)) {
                    console.log(`[${entity.typeId}] ✓ Found solid block: ${block.typeId} at Y=${checkLocation.y} (${Math.abs(y)} blocks offset)`);
                    return {
                        hasSolidBlockBelow: true,
                        block: block,
                        location: checkLocation,
                        distance: Math.abs(y)
                    };
                }
            } catch (blockError) {
                // Block outside world bounds, skip
                console.log(`  Checking Y=${checkLocation.y}: ERROR - ${blockError}`);
                continue;
            }
        }
        
        console.log(`[${entity.typeId}] ✗ No solid block found below (checked Y=${Math.floor(entityLocation.y)} to Y=${Math.floor(entityLocation.y) - maxDistance})`);
        return {
            hasSolidBlockBelow: false,
            block: null,
            location: null,
            distance: Infinity
        };
    } catch (error) {
        console.warn("Error checking solid blocks below entity:", error);
        return {
            hasSolidBlockBelow: false,
            block: null,
            location: null,
            distance: Infinity
        };
    }
}

/**
 * Storage for tracking solid block states (landing/takeoff detection)
 * Key: entity.id, Value: { hadSolidBlockBefore: boolean }
 */
const solidBlockStates = new Map();

/**
 * Storage for tracking rotation states (yaw detection)
 * Key: entity.id, Value: { previousViewX: number, previousViewZ: number }
 */
const rotationStates = new Map();

/**
 * Calculate the horizontal angle (yaw) from view direction vector
 * @param {number} x - X component of view direction
 * @param {number} z - Z component of view direction
 * @returns {number} Yaw angle in degrees
 */
function calculateYawFromDirection(x, z) {
    // Calculate yaw from x and z components
    let yaw = Math.atan2(x, z) * (180 / Math.PI);
    return yaw;
}

/**
 * Modular function to detect dragon's yaw rotation direction using view direction
 * Can be reused in other scripts by importing this function
 * @param {Entity} dragon - The dragon entity to check
 * @returns {Object} Object with rotation direction and view data
 */
export function detectYawRotation(dragon) {
    try {
        const dragonId = dragon.id;
        const viewDirection = dragon.getViewDirection();
        
        // Calculate current yaw from view direction
        const currentYaw = calculateYawFromDirection(viewDirection.x, viewDirection.z);
        
        // Get or create dragon rotation state
        let rotationState = rotationStates.get(dragonId);
        
        if (!rotationState) {
            rotationState = {
                previousViewX: viewDirection.x,
                previousViewZ: viewDirection.z
            };
            rotationStates.set(dragonId, rotationState);
        }
        
        const previousYaw = calculateYawFromDirection(
            rotationState.previousViewX,
            rotationState.previousViewZ
        );
        
        // Calculate yaw difference
        let yawDiff = currentYaw - previousYaw;
        
        // Handle wrapping around (e.g., from 179 to -179)
        if (yawDiff > 180) {
            yawDiff -= 360;
        } else if (yawDiff < -180) {
            yawDiff += 360;
        }
        
        // Determine rotation direction
        // In Minecraft's coordinate system:
        // Negative yawDiff = turning right, Positive yawDiff = turning left
        let rotationDirection = "none";
        const threshold = 1.0; // Minimum rotation to detect (degrees)
        
        if (yawDiff > threshold) {
            rotationDirection = "left";  // Positive = left
        } else if (yawDiff < -threshold) {
            rotationDirection = "right"; // Negative = right
        }
        
        // Update dragon's property based on rotation direction
        try {
            dragon.setProperty("re_dra:left_right", rotationDirection);
        } catch (propertyError) {
            console.warn("Error setting dragon left_right property:", propertyError);
        }
        
        // Only log when there's actual rotation
        if (rotationDirection !== "none") {
            console.log(`[ROTATION ${rotationDirection.toUpperCase()}] Dragon ID: ${dragonId}`);
            console.log(`  - Current Yaw: ${currentYaw.toFixed(2)}°`);
            console.log(`  - Previous Yaw: ${previousYaw.toFixed(2)}°`);
            console.log(`  - Yaw Difference: ${yawDiff.toFixed(2)}°`);
            console.log(`  - View Direction: x=${viewDirection.x.toFixed(3)}, z=${viewDirection.z.toFixed(3)}`);
        }
        
        // Update dragon's view direction in rotation state
        rotationState.previousViewX = viewDirection.x;
        rotationState.previousViewZ = viewDirection.z;
        
        return {
            entity: dragon,
            currentYaw: currentYaw,
            previousYaw: previousYaw,
            yawDifference: yawDiff,
            viewDirection: viewDirection,
            rotationDirection: rotationDirection,
            isLookingLeft: rotationDirection === "left",
            isLookingRight: rotationDirection === "right",
            isStable: rotationDirection === "none"
        };
    } catch (error) {
        console.warn(`Error detecting yaw rotation for dragon ${dragon.id}:`, error);
        return {
            entity: dragon,
            currentYaw: 0,
            previousYaw: 0,
            yawDifference: 0,
            viewDirection: { x: 0, y: 0, z: 0 },
            rotationDirection: "error",
            isLookingLeft: false,
            isLookingRight: false,
            isStable: false
        };
    }
}

/**
 * Detect transitions in solid block presence below dragon
 * Tracks "before" and "after" conditions:
 * - BEFORE: No solid block below → Solid block appears below
 * - AFTER: Solid block below → No solid block below
 * 
 * @param {Entity} dragon - The dragon entity to check
 * @returns {Object} Object with transition state and block info
 */
export function detectSolidBlockTransition(dragon) {
    try {
        const dragonId = dragon.id;
        const dragonLoc = dragon.location;
        
        // Get previous solid block state (default to false if new dragon)
        const previousState = solidBlockStates.get(dragonId) || { hadSolidBlockBefore: false };
        const hadSolidBlockBefore = previousState.hadSolidBlockBefore;
        
        // Determine which detection range to use
        let currentBlockData;
        let detectionRange;
        
        if (hadSolidBlockBefore) {
            // Dragon was on ground - use shorter range (0-2 blocks) to detect takeoff
            detectionRange = 2;
            console.log(`[Dragon ${dragonId}] Checking takeoff (0-${detectionRange} blocks)`);
            currentBlockData = checkSolidBlockBelow(dragon, detectionRange);
        } else {
            // Dragon was in air - use longer range (0-4 blocks) to detect landing
            detectionRange = 2;
            console.log(`[Dragon ${dragonId}] Checking landing (0-${detectionRange} blocks)`);
            currentBlockData = checkSolidBlockBelow(dragon, detectionRange);
        }
        
        const hasSolidBlockNow = currentBlockData.hasSolidBlockBelow;
        
        console.log(`[Dragon ${dragonId}] Y: ${dragonLoc.y.toFixed(2)} | Has block below: ${hasSolidBlockNow} | Distance: ${currentBlockData.distance}`);
        
        // Determine transition type
        let transitionType = "none";
        
        if (!hadSolidBlockBefore && hasSolidBlockNow) {
            // BEFORE condition: No solid block → Solid block appeared (LANDING)
            transitionType = "before";
            console.log(`[Dragon ${dragonId}] 🔵 BEFORE TRANSITION: Air → Ground (hadBefore: ${hadSolidBlockBefore}, hasNow: ${hasSolidBlockNow})`);
        } else if (hadSolidBlockBefore && !hasSolidBlockNow) {
            // AFTER condition: Solid block → No solid block (TAKEOFF)
            transitionType = "after";
            console.log(`[Dragon ${dragonId}] 🟢 AFTER TRANSITION: Ground → Air (hadBefore: ${hadSolidBlockBefore}, hasNow: ${hasSolidBlockNow})`);
        }
        
        // Update solid block state
        solidBlockStates.set(dragonId, { hadSolidBlockBefore: hasSolidBlockNow });
        
        return {
            entity: dragon,
            transitionType: transitionType,
            hasSolidBlockNow: hasSolidBlockNow,
            hadSolidBlockBefore: hadSolidBlockBefore,
            blockData: currentBlockData,
            detectionRange: detectionRange,
            // Helper flags for easy condition checking
            isBeforeCondition: transitionType === "before",
            isAfterCondition: transitionType === "after",
            isStable: transitionType === "none"
        };
    } catch (error) {
        console.warn(`Error detecting solid block transition for dragon ${dragon.id}:`, error);
        return {
            entity: dragon,
            transitionType: "error",
            hasSolidBlockNow: false,
            hadSolidBlockBefore: false,
            blockData: null,
            detectionRange: 0,
            isBeforeCondition: false,
            isAfterCondition: false,
            isStable: false
        };
    }
}

/**
 * Main function executed every tick
 * Detects dragons and checks for solid block transitions and yaw rotation
 */
function dragonFlightTick() {
    try {
        // Get all dragons
        const dragons = detectDragons();
        
        if (dragons.length === 0) {
            return; // No dragons to process
        }
        
        console.log(`========== Dragon Flight Tick | ${dragons.length} dragon(s) ==========`);
        
        // Process each dragon
        for (const dragon of dragons) {
            // Skip invalid dragons
            if (!dragon || !dragon.isValid) continue;
            
            // Detect solid block transitions for this dragon
            const transitionData = detectSolidBlockTransition(dragon);
            
            // Handle BEFORE condition: Landing on solid ground
            if (transitionData.isBeforeCondition) {
                // Dragon just landed on solid ground
                // Add your custom logic here
                // Example: Play landing sound, trigger event, etc.
                console.log(`🛬 Dragon ${dragon.id} landed on solid ground (BEFORE condition)`);
                console.log(`   Block: ${transitionData.blockData.block?.typeId}`);
                console.log(`   Distance: ${transitionData.blockData.distance} blocks`);
            }
            
            // Handle AFTER condition: Taking off from solid ground
            if (transitionData.isAfterCondition) {
                // Dragon just left solid ground (flying/falling)
                // Add your custom logic here
                // Example: Play takeoff sound, trigger event, etc.
                console.log(`🛫 Dragon ${dragon.id} left solid ground (AFTER condition)`);
                console.log(`   Was on block, now airborne`);
            }
            
            // Detect yaw rotation for this dragon
            const yawData = detectYawRotation(dragon);
            
            // Handle looking left
            if (yawData.isLookingLeft) {
                console.log(`[ROTATION LEFT] Dragon: ${dragon.id}`);
                console.log(`  - Current Yaw: ${yawData.currentYaw.toFixed(2)}°`);
                console.log(`  - Previous Yaw: ${yawData.previousYaw.toFixed(2)}°`);
                console.log(`  - Yaw Difference: ${yawData.yawDifference.toFixed(2)}°`);
                console.log(`  - View Direction: x=${yawData.viewDirection.x.toFixed(3)}, z=${yawData.viewDirection.z.toFixed(3)}`);
                console.log(`  - Rotation Direction: ${yawData.rotationDirection}`);
                console.log(`  - Property set: re_dra:left_right = "left"`);
            }
            
            // Handle looking right
            if (yawData.isLookingRight) {
                console.log(`[ROTATION RIGHT] Dragon: ${dragon.id}`);
                console.log(`  - Current Yaw: ${yawData.currentYaw.toFixed(2)}°`);
                console.log(`  - Previous Yaw: ${yawData.previousYaw.toFixed(2)}°`);
                console.log(`  - Yaw Difference: ${yawData.yawDifference.toFixed(2)}°`);
                console.log(`  - View Direction: x=${yawData.viewDirection.x.toFixed(3)}, z=${yawData.viewDirection.z.toFixed(3)}`);
                console.log(`  - Rotation Direction: ${yawData.rotationDirection}`);
                console.log(`  - Property set: re_dra:left_right = "right"`);
            }
            
            // Handle stable rotation (no left/right movement - reset condition)
            if (yawData.isStable) {
                // Dragon is not rotating or rotation is below threshold
                // This is when the dragon stops turning (neutral/stable state)
                // Add your reset/stable logic here
                // Example: Reset dragon steering to neutral, clear previous steering commands, etc.
                console.log(`  - Property set: re_dra:left_right = "none"`);
            }
            
            // Optional: Log stable states for debugging
            if (transitionData.isStable) {
                // No transition, dragon is stable (either on ground or in air)
                const state = transitionData.hasSolidBlockNow ? "on ground" : "airborne";
                console.log(`   Stable state: ${state}`);
            }
            
            // Access detailed block data if needed
            if (transitionData.blockData && transitionData.blockData.hasSolidBlockBelow) {
                const blockBelow = transitionData.blockData.block;
                // Do something with the block below data
            }
        }
        
        console.log(`====================================================`);
    } catch (error) {
        console.warn("Error in dragonFlightTick:", error);
    }
}

/**
 * Initialize the Dragon flight sensor system
 * Starts the 1-tick interval for detecting dragons, solid blocks, and yaw rotation
 */
function initializeDragonFlightSystem() {
    console.log("Dragon flight sensor system initialized - Running every tick");
    
    // Run the tick function every tick (1 tick interval for accurate yaw detection)
    system.runInterval(() => {
        dragonFlightTick();
    }, 1);
}

// Auto-initialize when script loads
initializeDragonFlightSystem();


