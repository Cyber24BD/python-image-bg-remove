from django.core.management.base import BaseCommand
import os
import time
from django.conf import settings

class Command(BaseCommand):
    help = 'Deletes uploaded and result files older than 1 hour'

    def handle(self, *args, **options):
        directories = [
            os.path.join(settings.MEDIA_ROOT, 'uploads'),
            os.path.join(settings.MEDIA_ROOT, 'results')
        ]
        
        cutoff_time = time.time() - 3600 # 1 hour ago
        deleted_count = 0
        
        for directory in directories:
            if not os.path.exists(directory):
                continue
                
            for filename in os.listdir(directory):
                file_path = os.path.join(directory, filename)
                try:
                    if os.path.isfile(file_path):
                        file_mtime = os.path.getmtime(file_path)
                        if file_mtime < cutoff_time:
                            os.remove(file_path)
                            deleted_count += 1
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'Error deleting {filename}: {e}'))
                    
        self.stdout.write(self.style.SUCCESS(f'Successfully deleted {deleted_count} old files'))
