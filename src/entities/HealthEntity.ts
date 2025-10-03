import Signal from "util/signal";
import WorldEntity from "./WorldEntity";

declare global {
  interface GameEntities {
    HealthEntity: typeof HealthEntity;
  }
}

interface AttackerInfo {
  entityId: string;
  time: number;
}

abstract class HealthEntity extends WorldEntity {
  abstract health: number;
  abstract maxHealth: number;

  readonly tookDamage = new Signal<[old: number, new: number, attacker?: WorldEntity]>();
  readonly died = new Signal<[attacker?: WorldEntity]>();
  readonly attackersList: AttackerInfo[] = [];

  constructor() {
    super();

    this.inheritanceList.add("HealthEntity");
  }

  takeDamage(amount: number, attacker?: WorldEntity) {
    const previousHealthAmount = this.health;

    this.health -= amount;
    this.health = math.clamp(this.health, 0, this.maxHealth);

    if (attacker)
      this.attackersList.push({ entityId: attacker.id, time: time() });
    this.attackersList.sort((a, b) => a.time > b.time);

    this.tookDamage.Fire(previousHealthAmount, this.health, attacker);

    if (previousHealthAmount > 0 && this.health <= 0)
      this.died.Fire(attacker);
  }
}

export = HealthEntity;
