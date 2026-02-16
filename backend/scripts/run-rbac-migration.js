#!/usr/bin/env node
/**
 * Migration Runner for RBAC
 * Run with: node scripts/run-rbac-migration.js
 */

const { sequelize } = require('../dist/dbClient');
const { logger } = require('../dist/logger');

async function runMigration() {
    try {
        logger.info('Starting RBAC migration...');

        // Step 1: Add admin enum value
        await sequelize.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type t 
                         JOIN pg_enum e ON t.oid = e.enumtypid  
                         WHERE t.typname = 'key_type_enum' 
                         AND e.enumlabel = 'admin') THEN
              ALTER TYPE spotlight.key_type_enum ADD VALUE 'admin';
          END IF;
      END$$;
    `);
        logger.info('✅ Admin role added to key_type_enum');

        // Step 2: Add permissions column
        await sequelize.query(`
      ALTER TABLE spotlight.shinzo_api_key
      ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';
    `);
        logger.info('✅ Permissions column added');

        // Step 3: Create indexes
        await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_api_key_permissions 
      ON spotlight.shinzo_api_key USING gin(permissions);
    `);
        logger.info('✅ Permissions index created');

        await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_api_key_type 
      ON spotlight.shinzo_api_key(key_type);
    `);
        logger.info('✅ Key type index created');

        // Step 4: Update existing keys with default permissions
        const [result] = await sequelize.query(`
      UPDATE spotlight.shinzo_api_key
      SET permissions = 
          CASE key_type
              WHEN 'read_only' THEN '{
                  "sessions": ["read"],
                  "analytics": ["read"],
                  "redaction": ["read"]
              }'::jsonb
              WHEN 'read_write' THEN '{
                  "sessions": ["read"],
                  "analytics": ["read"],
                  "export": ["read", "write"],
                  "share": ["read", "write"],
                  "redaction": ["read"]
              }'::jsonb
              ELSE '{}'::jsonb
          END
      WHERE permissions = '{}'::jsonb;
    `);
        logger.info(`✅ Updated ${result.rowCount} existing keys with permissions`);

        logger.info('🎉 RBAC migration completed successfully!');
        process.exit(0);
    } catch (error) {
        logger.error({ message: 'Migration failed', error });
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

runMigration();
