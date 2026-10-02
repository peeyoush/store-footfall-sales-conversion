import os

import snowflake.connector
from dotenv import load_dotenv
from pathlib import Path
import re
load_dotenv()

SNOWFLAKE_ACCOUNT = os.getenv("SNOWFLAKE_ACCOUNT", "")
SNOWFLAKE_USER = os.getenv("SNOWFLAKE_USER", "")
SNOWFLAKE_PASSWORD = os.getenv("SNOWFLAKE_PASSWORD", "")
SNOWFLAKE_WAREHOUSE = os.getenv("SNOWFLAKE_WAREHOUSE", "")
SNOWFLAKE_DATABASE = os.getenv("SNOWFLAKE_DATABASE", "")
SNOWFLAKE_SCHEMA = os.getenv("SNOWFLAKE_SCHEMA", "")


def get_connection():
    return snowflake.connector.connect(
        account=SNOWFLAKE_ACCOUNT,
        user=SNOWFLAKE_USER,
        password=SNOWFLAKE_PASSWORD,
        warehouse=SNOWFLAKE_WAREHOUSE,
        database=SNOWFLAKE_DATABASE,
        schema=SNOWFLAKE_SCHEMA,
    )


def test_connection():
    connection = get_connection()

    try:
        cursor = connection.cursor()
        cursor.execute("SELECT 1")
        result = cursor.fetchone()
        return result[0] == 1
    finally:
        cursor.close()
        connection.close()

def upload_file_to_stage(run_id: str, local_path: Path):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        stage_path = (
            f"@CAPSTONE_DB.ANALYTICS.UPLOAD_GOLD_STAGE/{run_id}"
        )

        file_uri = local_path.resolve().as_uri()

        sql = f"""
            PUT '{file_uri}'
            {stage_path}
            AUTO_COMPRESS = FALSE
            OVERWRITE = TRUE
        """

        cursor.execute(sql)

        return cursor.fetchall()

    finally:
        cursor.close()
        connection.close()   


def copy_uploaded_gold(run_id: str):
    if not re.fullmatch(r"[0-9a-f]{32}", run_id):
        raise ValueError("Invalid run_id format.")

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT COUNT(*)
            FROM CAPSTONE_DB.ANALYTICS.GOLD_STORE_HOUR_UPLOADS
            WHERE run_id = %s
            """,
            (run_id,),
        )

        existing_rows = cursor.fetchone()[0]

        if existing_rows > 0:
            return [
                f"Run {run_id} already loaded with "
                f"{existing_rows} rows. COPY skipped."
            ]

        sql = f"""
            COPY INTO CAPSTONE_DB.ANALYTICS.GOLD_STORE_HOUR_UPLOADS
            (
                run_id,
                store_id,
                city,
                format,
                trade_date,
                hour,
                is_weekend,
                footfall,
                bills,
                revenue,
                conversion_rate,
                sensor_ok
            )
            FROM (
                SELECT
                    '{run_id}',
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9,
                    $10,
                    $11
                FROM @CAPSTONE_DB.ANALYTICS.UPLOAD_GOLD_STAGE/{run_id}/GOLD_STORE_HOUR_FROM_DATABRICKS.csv
            )
            FILE_FORMAT = (
                FORMAT_NAME =
                'CAPSTONE_DB.ANALYTICS.CAPSTONE_CSV_FORMAT'
            )
            ON_ERROR = 'ABORT_STATEMENT'
        """

        cursor.execute(sql)
        result = cursor.fetchall()
        connection.commit()

        return result

    finally:
        cursor.close()
        connection.close()

def get_upload_summary(run_id: str):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                COUNT(*) AS row_count,
                COALESCE(SUM(footfall), 0) AS total_footfall,
                COALESCE(SUM(bills), 0) AS total_bills,
                COALESCE(SUM(revenue), 0) AS total_revenue,
                ROUND(
                    100.0 * COALESCE(SUM(bills), 0)
                    / NULLIF(SUM(footfall), 0),
                    2
                ) AS conversion_rate
            FROM CAPSTONE_DB.ANALYTICS.GOLD_STORE_HOUR_UPLOADS
            WHERE run_id = %s
            """,
            (run_id,),
        )

        row = cursor.fetchone()

        return {
            "run_id": run_id,
            "row_count": row[0],
            "total_footfall": row[1],
            "total_bills": row[2],
            "total_revenue": float(row[3]),
            "conversion_rate": float(row[4]),
        }

    finally:
        cursor.close()
        connection.close()


def get_upload_rows(run_id: str):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                store_id,
                city,
                format,
                trade_date,
                hour,
                is_weekend,
                footfall,
                bills,
                revenue,
                conversion_rate,
                sensor_ok
            FROM CAPSTONE_DB.ANALYTICS.GOLD_STORE_HOUR_UPLOADS
            WHERE run_id = %s
            ORDER BY store_id, trade_date, hour
            """,
            (run_id,),
        )

        columns = [column[0].lower() for column in cursor.description]
        rows = cursor.fetchall()

        return [
            {
                column: value
                for column, value in zip(columns, row)
            }
            for row in rows
        ]

    finally:
        cursor.close()
        connection.close()