"""
Background removal service using withoutbg and rembg engines.

This module provides a unified interface for background removal using
two open-source engines: withoutbg (primary) and rembg (fallback).
"""
from io import BytesIO
from PIL import Image


class BackgroundRemover:
    """Service class for removing backgrounds from images."""
    
    _withoutbg_model = None
    _rembg_session = None
    
    @classmethod
    def get_withoutbg_model(cls):
        """Get or initialize the withoutbg model (singleton pattern)."""
        if cls._withoutbg_model is None:
            from withoutbg import WithoutBG
            cls._withoutbg_model = WithoutBG.opensource()
        return cls._withoutbg_model
    
    @classmethod
    def get_rembg_session(cls):
        """Get or initialize the rembg session (singleton pattern)."""
        if cls._rembg_session is None:
            from rembg import new_session
            cls._rembg_session = new_session()
        return cls._rembg_session
    
    @staticmethod
    def remove_with_withoutbg(image_path: str) -> Image.Image:
        """
        Remove background using withoutbg engine.
        
        Args:
            image_path: Path to the input image
            
        Returns:
            PIL Image with transparent background
        """
        model = BackgroundRemover.get_withoutbg_model()
        result = model.remove_background(image_path)
        return result
    
    @staticmethod
    def remove_with_rembg(image_path: str) -> Image.Image:
        """
        Remove background using rembg engine.
        
        Args:
            image_path: Path to the input image
            
        Returns:
            PIL Image with transparent background
        """
        from rembg import remove
        
        session = BackgroundRemover.get_rembg_session()
        input_image = Image.open(image_path)
        output = remove(input_image, session=session)
        return output
    
    @staticmethod
    def composite_background(foreground_path: str, color_hex: str = None, bg_image_path: str = None) -> Image.Image:
        """
        Composite a transparent foreground image over a background color or image.
        
        Args:
            foreground_path: Path to the transparent PNG
            color_hex: Hex color code (e.g., '#FFFFFF')
            bg_image_path: Path to background image file
            
        Returns:
            PIL Image with new background
        """
        foreground = Image.open(foreground_path).convert("RGBA")
        
        if bg_image_path:
            background = Image.open(bg_image_path).convert("RGBA")
            # Resize background to fill (cover) the foreground dimensions
            bg_ratio = background.width / background.height
            fg_ratio = foreground.width / foreground.height
            
            if bg_ratio > fg_ratio:
                # Background is wider
                new_height = foreground.height
                new_width = int(new_height * bg_ratio)
            else:
                # Background is taller
                new_width = foreground.width
                new_height = int(new_width / bg_ratio)
                
            background = background.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            # Center crop
            left = (background.width - foreground.width) // 2
            top = (background.height - foreground.height) // 2
            background = background.crop((left, top, left + foreground.width, top + foreground.height))
            
        elif color_hex:
            # Parse hex color
            color = color_hex.lstrip('#')
            rgb = tuple(int(color[i:i+2], 16) for i in (0, 2, 4))
            background = Image.new("RGBA", foreground.size, rgb + (255,))
        else:
            return foreground

        # Composite
        return Image.alpha_composite(background, foreground)

    @staticmethod
    def process(image_path: str, engine: str = 'withoutbg') -> Image.Image:
        """
        Process an image and remove its background.
        
        Args:
            image_path: Path to the input image
            engine: Engine to use ('withoutbg' or 'rembg')
            
        Returns:
            PIL Image with transparent background
            
        Raises:
            ValueError: If an unknown engine is specified
        """
        if engine == 'withoutbg':
            return BackgroundRemover.remove_with_withoutbg(image_path)
        elif engine == 'rembg':
            return BackgroundRemover.remove_with_rembg(image_path)
        else:
            raise ValueError(f"Unknown engine: {engine}. Use 'withoutbg' or 'rembg'")
    
    @staticmethod
    def image_to_bytes(image: Image.Image) -> bytes:
        """Convert PIL Image to PNG bytes."""
        buffer = BytesIO()
        image.save(buffer, format='PNG')
        buffer.seek(0)
        return buffer.getvalue()
