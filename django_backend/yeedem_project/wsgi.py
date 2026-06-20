import os
import sys

# Get the directory of wsgi.py
current_dir = os.path.dirname(os.path.abspath(__file__)) # .../django_backend/yeedem_project
django_project_dir = os.path.dirname(current_dir)       # .../django_backend

if django_project_dir not in sys.path:
    sys.path.insert(0, django_project_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'yeedem_project.settings')

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()

