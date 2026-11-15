# usage: reset.sh [dbname]  -> fresh clone of the pristine 40-step chain DB (e_sb) as e_run, PostgREST repointed. Scratch only.
. /home/claude/pp-work/EXEC/e4-verify/web/e2e_verify/env.sh
DB=${1:-e_run}
pkill -f e4_pgrst.conf 2>/dev/null; sleep 0.7
psql -h /tmp -p $PGPORT -U postgres -X -q -d postgres -c "drop database if exists $DB" -c "create database $DB template e_sb"
bash $E/web/e2e_verify/pgrst.sh $DB >/dev/null
