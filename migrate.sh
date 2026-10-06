#!/bin/bash
# Applies every file in migrations/ in filename order.
#
# Deliberately a loop rather than a hand-written list: the list version silently
# stopped at 009 while 010 and 011 sat in the repo unapplied, so databases ended
# up missing columns the code already queried. A new migration is picked up here
# the moment it is added.
#
# Migrations are one-time scripts. Re-running this over an already-migrated
# database reports errors for the ones that have already been applied; that is
# expected and harmless.
echo "Running migrations..."
for migration in migrations/*.sql; do
  echo "  -> $migration"
  docker compose exec -T db mysql -uroot -proot123 assignment_hub < "$migration"
done
echo "Migrations complete!"
