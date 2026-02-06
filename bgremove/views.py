"""
Views for the background removal app.
"""
import os
import uuid
from django.conf import settings
from django.http import JsonResponse, FileResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .services import BackgroundRemover


def index(request):
    """Render the main landing page."""
    return render(request, 'bgremove/index.html')


@csrf_exempt
@require_http_methods(["POST"])
def upload_image(request):
    """
    Handle image upload and background removal.
    
    Accepts: multipart/form-data with 'image' file and 'engine' choice
    Returns: JSON with result image URL or error message
    """
    if 'image' not in request.FILES:
        return JsonResponse({'error': 'No image uploaded'}, status=400)
    
    image_file = request.FILES['image']
    engine = request.POST.get('engine', 'withoutbg')
    
    # Validate engine choice
    if engine not in ['withoutbg', 'rembg']:
        return JsonResponse({'error': 'Invalid engine choice'}, status=400)
    
    # Validate file type
    allowed_types = ['image/jpeg', 'image/png', 'image/webp']
    if image_file.content_type not in allowed_types:
        return JsonResponse({
            'error': 'Invalid file type. Please upload JPEG, PNG, or WebP images.'
        }, status=400)
    
    # Create media directories if needed
    uploads_dir = os.path.join(settings.MEDIA_ROOT, 'uploads')
    results_dir = os.path.join(settings.MEDIA_ROOT, 'results')
    os.makedirs(uploads_dir, exist_ok=True)
    os.makedirs(results_dir, exist_ok=True)
    
    # Generate unique filename
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(image_file.name)[1] or '.png'
    upload_path = os.path.join(uploads_dir, f'{file_id}{ext}')
    result_path = os.path.join(results_dir, f'{file_id}_nobg.png')
    
    # Save uploaded file
    with open(upload_path, 'wb+') as destination:
        for chunk in image_file.chunks():
            destination.write(chunk)
    
    try:
        # Process the image
        result_image = BackgroundRemover.process(upload_path, engine=engine)
        result_image.save(result_path, 'PNG')
        
        # Return URLs
        result_url = f'{settings.MEDIA_URL}results/{file_id}_nobg.png'
        original_url = f'{settings.MEDIA_URL}uploads/{file_id}{ext}'
        
        return JsonResponse({
            'success': True,
            'original_url': original_url,
            'result_url': result_url,
            'filename': f'{file_id}_nobg.png'
        })
        
    except Exception as e:
        return JsonResponse({
            'error': f'Processing failed: {str(e)}'
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def composite_image(request):
    """
    Apply background color or image to a processed foreground.
    """
    filename = request.POST.get('filename')
    color = request.POST.get('color')
    
    if not filename:
        return JsonResponse({'error': 'Filename required'}, status=400)
        
    # Paths
    results_dir = os.path.join(settings.MEDIA_ROOT, 'results')
    source_path = os.path.join(results_dir, filename)  # The transparent PNG
    
    # Ensure source exists (security check to prevent path traversal)
    if not os.path.exists(source_path) or not os.path.dirname(source_path) == results_dir:
        return JsonResponse({'error': 'File not found'}, status=404)
        
    # Generate new filename for the composite
    composite_id = f"{os.path.splitext(filename)[0]}_edit_{str(uuid.uuid4())[:8]}.png"
    composite_path = os.path.join(results_dir, composite_id)
    
    try:
        bg_image_path = None
        if 'bg_image' in request.FILES:
            bg_file = request.FILES['bg_image']
            # Save temp bg file
            uploads_dir = os.path.join(settings.MEDIA_ROOT, 'uploads')
            bg_image_path = os.path.join(uploads_dir, f"bg_{uuid.uuid4()}{os.path.splitext(bg_file.name)[1]}")
            with open(bg_image_path, 'wb+') as dest:
                for chunk in bg_file.chunks():
                    dest.write(chunk)
                    
        # Create composite
        result_image = BackgroundRemover.composite_background(
            source_path, 
            color_hex=color, 
            bg_image_path=bg_image_path
        )
        result_image.save(composite_path, 'PNG')
        
        # Cleanup temp bg file
        if bg_image_path and os.path.exists(bg_image_path):
            os.remove(bg_image_path)
            
        return JsonResponse({
            'success': True,
            'result_url': f'{settings.MEDIA_URL}results/{composite_id}',
            'filename': composite_id
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def download_batch_zip(request):
    """
    Create and return a ZIP file containing multiple processed images.
    """
    import json
    import zipfile
    from io import BytesIO
    
    try:
        data = json.loads(request.body)
        filenames = data.get('filenames', [])
        
        if not filenames:
            return JsonResponse({'error': 'No files specified'}, status=400)
            
        # Create ZIP in memory
        buffer = BytesIO()
        with zipfile.ZipFile(buffer, 'w') as zip_file:
            for filename in filenames:
                file_path = os.path.join(settings.MEDIA_ROOT, 'results', filename)
                if os.path.exists(file_path):
                    zip_file.write(file_path, filename)
                    
        buffer.seek(0)
        response = FileResponse(buffer, as_attachment=True, filename='toamun-batch-results.zip')
        return response
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


def download_result(request, filename):
    """
    Download a processed image result.
    
    Args:
        filename: The filename of the processed image
    """
    file_path = os.path.join(settings.MEDIA_ROOT, 'results', filename)
    
    if not os.path.exists(file_path):
        return JsonResponse({'error': 'File not found'}, status=404)
    
    return FileResponse(
        open(file_path, 'rb'),
        as_attachment=True,
        filename=filename
    )
