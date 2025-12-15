import { world, system, Entity, Player } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";

export function autoTameDrone(drone: Entity, player: Player): boolean {
    const tameable = drone.getComponent("minecraft:tameable");
    if (tameable && !tameable.tamedToPlayerId) {
        try {
            tameable.tame(player);
            player.sendMessage("§aBaby Dragon tamed");
            player.playSound("ttdButtonOn", { pitch: 1.2, volume: 1.0 });
            return true;
        } catch (error) {
            
            return false;
        }
    }
    return tameable !== null && tameable.tamedToPlayerId === player.id;
}

world.afterEvents.entitySpawn.subscribe((event) => {
    const entity = event.entity;
    
    if (entity.typeId !== "re_dra:dragon_baby") return;
    entity.dimension.spawnParticle("minecraft:happy_villager", {
        x: entity.location.x,
        y: entity.location.y,
        z: entity.location.z
    });

    const nearbyPlayers = entity.dimension.getEntities({
        type: "minecraft:player",
        location: entity.location,
        maxDistance: 7
    });
    
    if (nearbyPlayers.length > 0) {
        const spawner = nearbyPlayers[0] as Player;
        
        system.runTimeout(() => {
            // Show naming form to the player
            const nameForm = new ModalFormData()
                .title("NAME YOUR DRAGON")
                .textField("Enter dragon name...", "My Dragon");
            
            nameForm.show(spawner).then((response) => {
                let dragonName: string;
                
                if (response.canceled || !response.formValues || !response.formValues[0] || response.formValues[0].trim() === "") {
                    // Player closed form or didn't enter a name, use default
                    dragonName = `${spawner.name}'s Dragon`;
                } else {
                    // Use the name entered by player
                    dragonName = response.formValues[0].trim();
                }
                
                // Set the dragon's nametag
                entity.nameTag = dragonName;
                
                // Now auto-tame the dragon
                autoTameDrone(entity, spawner);
            });
        }, 5);
    }
});

