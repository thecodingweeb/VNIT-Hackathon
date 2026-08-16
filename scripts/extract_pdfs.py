import PyPDF2
import os

pdf_files = [
    "PRD_Tiger_Camera_Trap_System_Pench.pdf",
    "TRD_Tiger_Camera_Trap_System_Pench.pdf",
    "UIUX_Design_System_Tiger_Intelligence.pdf",
    "Website_Flow_Build_Guide_TigerWatch.pdf"
]

base_dir = r"c:\Users\LOQ\Desktop\Hackathon"

for pdf_file in pdf_files:
    filepath = os.path.join(base_dir, pdf_file)
    print(f"\n{'='*80}")
    print(f"FILE: {pdf_file}")
    print(f"{'='*80}")
    try:
        reader = PyPDF2.PdfReader(filepath)
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text:
                print(f"\n--- Page {i+1} ---")
                print(text)
    except Exception as e:
        print(f"Error reading {pdf_file}: {e}")
