from django.apps import AppConfig

class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        import sys
        import os
        
        # Avoid running migrations recursively or during manage.py commands like migrate or makemigrations
        if any(arg in sys.argv for arg in ['makemigrations', 'migrate', 'collectstatic', 'createsuperuser']):
            return
            
        # Prevent double execution in reload/dev environment
        if os.environ.get('RUN_MAIN') == 'true':
            return

        try:
            # Run raw SQL fallbacks to inject columns if they do not yet exist
            from django.db import connection
            with connection.cursor() as cursor:
                # Add subscription_plan column
                try:
                    cursor.execute("ALTER TABLE api_businessprofile ADD COLUMN subscription_plan VARCHAR(50) DEFAULT 'starter';")
                    print("[AUTO-MIGRATION] Added subscription_plan column successfully via raw SQL.")
                except Exception as ex:
                    # Column might already exist, or table doesn't exist yet
                    pass

                # Add subscription_status column
                try:
                    cursor.execute("ALTER TABLE api_businessprofile ADD COLUMN subscription_status VARCHAR(50) DEFAULT 'active';")
                    print("[AUTO-MIGRATION] Added subscription_status column successfully via raw SQL.")
                except Exception as ex:
                    # Column might already exist, or table doesn't exist yet
                    pass
        except Exception as sql_e:
            print("[AUTO-MIGRATION] Raw SQL startup hook bypass:", sql_e)

        try:
            from django.core.management import call_command
            print("[AUTO-MIGRATION] Checking & applying database migrations for api...")
            try:
                call_command('makemigrations', 'api')
            except Exception as make_err:
                print("[AUTO-MIGRATION] makemigrations failed (might be read-only filesystem):", make_err)
            
            try:
                call_command('migrate')
                print("[AUTO-MIGRATION] Migration check completed successfully.")
            except Exception as migrate_cmd_err:
                print("[AUTO-MIGRATION] migrate command failed (expected if DB matches schema):", migrate_cmd_err)
        except Exception as e:
            print("[AUTO-MIGRATION] Warning: Automatic migration failed, continuing:", e)
