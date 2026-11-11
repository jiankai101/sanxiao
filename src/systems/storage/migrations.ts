/**
 * 版本迁移注册表（plan 11.4）。当前仅 v1，无迁移。
 * 未来新增字段必须提升 SAVE_VERSION、登记 CR 并补充 v(n)→v(n+1) 迁移与测试。
 */
export const MIGRATIONS: Readonly<Record<number, (raw: unknown) => unknown>> = Object.freeze({});

export function hasMigration(fromVersion: number): boolean {
  return Object.prototype.hasOwnProperty.call(MIGRATIONS, fromVersion);
}
