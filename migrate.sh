#!/bin/bash
echo "Running migrations..."
docker compose exec -T db mysql -uroot -proot123 assignment_hub < migrations/001_identity.sql
docker compose exec -T db mysql -uroot -proot123 assignment_hub < migrations/002_task_type.sql
docker compose exec -T db mysql -uroot -proot123 assignment_hub < migrations/003_status_updated_at.sql
docker compose exec -T db mysql -uroot -proot123 assignment_hub < migrations/004_notification_settings.sql
echo "Migrations complete!"
