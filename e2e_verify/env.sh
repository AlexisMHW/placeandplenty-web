export E=/home/claude/pp-work/EXEC/e4-verify
export PGD=/tmp/e4_pg; export PGPORT=54493
export Q=$E/native/supabase/qa_package
export M=$E/native/supabase/migrations
P(){ psql -X -q -h /tmp -p $PGPORT -U postgres -v ON_ERROR_STOP=1 "$@"; }

export E_PGPORT=$PGPORT
