import os
import sqlalchemy

from db_connect import connect_with_connector

pool = connect_with_connector()

with pool.connect() as conn:
    with open('populate_db.sql', 'r') as f:
        for statement in f.readlines():
            conn.execute(sqlalchemy.text(statement))
    
    conn.commit()
        