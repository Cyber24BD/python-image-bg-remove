# Python Image Background Remover

An open-source, high-accuracy background removal tool powered by deep learning models. This project leverages the `withoutbg` and `rembg` engines to provide superior results for removing backgrounds from images.

## Features

-   **High Accuracy**: Utilizes advanced AI models to precisely separate foregrounds from backgrounds.
-   **Dual Engine Support**: Choose between `withoutbg` (default, high accuracy) and `rembg` engines for your specific needs.
-   **Batch Processing**: Process multiple images at once and download results as a ZIP file.
-   **Image Composition**: Easily add solid colors or custom images as new backgrounds for your processed images.
-   **Web Interface**: Simple and intuitive Django-based web interface.
-   **API Support**: RESTful endpoints for integrating background removal into your own applications.

## Technologies

-   **Backend**: Django
-   **AI/ML Engines**: `withoutbg`, `rembg`, `onnxruntime`
-   **Image Processing**: Pillow (PIL)
-   **Package Management**: uv / pip

## Installation

### Prerequisites

-   Python 3.12 or higher
-   `uv` package manager (recommended) or `pip`

### Steps

1.  **Clone the Repository**

    ```bash
    git clone https://github.com/Cyber24BD/python-image-bg-remove.git
    cd python-image-bg-remove
    ```

2.  **Install Dependencies**

    Using `uv`:
    ```bash
    uv sync
    ```

    Or using `pip`:
    ```bash
    pip install -r requirements.txt
    ```
    *(Note: If `requirements.txt` is not present, generate it from `pyproject.toml` or install dependencies manually.)*

3.  **Run Migrations**

    ```bash
    uv run manage.py migrate
    # or
    python manage.py migrate
    ```

4.  **Start the Development Server**

    ```bash
    uv run manage.py runserver
    # or
    python manage.py runserver
    ```

5.  **Access the Application**
    Open your browser and navigate to `http://127.0.0.1:8000`.

## Usage

### Web Interface
1.  Go to the home page.
2.  Upload an image (JPEG, PNG, WebP).
3.  Select the processing engine (`withoutbg` for higher accuracy).
4.  View the result, download it, or edit the background.

### API
**POST /upload/**
-   **image**: (File) The image file to process.
-   **engine**: (String) `withoutbg` or `rembg`.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT License](LICENSE)
