const path = require('path');
const config = require('../config.json');
const db = require('./schemas/db');
const MigrationRunner = require('./schemas/migrations/MigrationRunner');

const dbType = config.database.postgresql?.enabled ? 'postgres' : 'sqlite';
const runner = new MigrationRunner(db, dbType);

const command = process.argv[2];
const migrationName = process.argv[3];

const run = async () => {
    try {
        switch (command) {
            case 'status':
                await showStatus();
                break;
            case 'up':
                await runUp();
                break;
            case 'down':
                if (!migrationName) {
                    console.error('Error: Migration name required for rollback');
                    console.error('Usage: npm run migrate down <migration_name>');
                    process.exit(1);
                }
                await runDown(migrationName);
                break;
            case 'reset':
                await reset();
                break;
            default:
                showHelp();
        }
    } catch (err) {
        console.error('Migration error:', err.message);
        process.exit(1);
    } finally {
        process.exit(0);
    }
};

const showStatus = async () => {
    console.log(`\n📊 Migration Status (${dbType})\n`);
    
    const applied = await runner.getAppliedMigrations();
    const files = await runner.getMigrationFiles();
    
    console.log('Applied Migrations:');
    if (applied.length === 0) {
        console.log('  (none)');
    } else {
        applied.forEach(m => console.log(`  ✓ ${m}`));
    }
    
    const pending = files.filter(f => !applied.includes(f));
    console.log('\nPending Migrations:');
    if (pending.length === 0) {
        console.log('  (all up to date)');
    } else {
        pending.forEach(m => console.log(`  ⏳ ${m}`));
    }
    
    console.log(`\nTotal: ${applied.length} applied, ${pending.length} pending\n`);
};

const runUp = async () => {
    console.log('\n🚀 Running pending migrations...\n');
    await runner.initialize();
    console.log('\n✓ Migrations completed\n');
};

const runDown = async (name) => {
    console.log(`\n⏮️  Rolling back: ${name}\n`);
    await runner.rollbackMigration(name);
    console.log(`\n✓ Rolled back: ${name}\n`);
};

const reset = async () => {
    const confirm = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    confirm.question('⚠️  This will rollback ALL migrations. Continue? (yes/no): ', async (answer) => {
        confirm.close();
        
        if (answer !== 'yes') {
            console.log('Cancelled\n');
            process.exit(0);
        }
        
        console.log('\n⏮️  Rolling back all migrations...\n');
        const applied = await runner.getAppliedMigrations();
        
        for (const migration of applied.reverse()) {
            try {
                await runner.rollbackMigration(migration);
                console.log(`✓ Rolled back: ${migration}`);
            } catch (err) {
                console.error(`✗ Failed to rollback ${migration}:`, err.message);
            }
        }
        
        console.log('\n✓ All migrations rolled back\n');
        process.exit(0);
    });
};

const showHelp = () => {
    console.log(`
📚 Migration CLI

Usage:
  npm run migrate <command>

Commands:
  status     Show migration status
  up         Run all pending migrations
  down       Rollback a specific migration
  reset      Rollback ALL migrations (with confirmation)

Examples:
  npm run migrate status
  npm run migrate up
  npm run migrate down 001_add_notification_channel_to_preferences.js
  npm run migrate reset
    `);
};

run();
