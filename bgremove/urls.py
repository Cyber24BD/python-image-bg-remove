"""
URL patterns for the background removal app.
"""
from django.urls import path
from . import views

app_name = 'bgremove'

urlpatterns = [
    path('', views.index, name='index'),
    path('api/upload/', views.upload_image, name='upload'),
    path('api/composite/', views.composite_image, name='composite'),
    path('api/batch-zip/', views.download_batch_zip, name='batch_zip'),
    path('api/download/<str:filename>/', views.download_result, name='download'),
]
