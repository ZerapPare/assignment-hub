@echo off
REM Applies every file in migrations\ in filename order.
REM
REM Deliberately a loop rather than a hand-written list: the list version had
REM drifted badly — it named a 001_init.sql that does not exist, ran 010 before
REM 009, and never ran 011 at all, so databases ended up missing columns the
REM code already queried. A new migration is picked up here the moment it is
REM added.
REM
REM Migrations are one-time scripts. Re-running this over an already-migrated
REM database reports errors for the ones already applied; that is expected.
echo Running migrations...
for /f "delims=" %%f in ('dir /b /on migrations\*.sql') do (
  echo   -^> %%f
  docker compose exec -T db mysql -uroot -proot123 assignment_hub < "migrations\%%f"
)
echo Migrations complete!
