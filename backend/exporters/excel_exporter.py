"""
Excel Exporter using openpyxl for Python Backend
Creates multi-sheet workbook with frozen header, auto-filter, and column autosizing
"""

import io
from typing import Dict, Any
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def create_excel_report(job: Dict[str, Any]) -> bytes:
    wb = openpyxl.Workbook()
    
    # Sheet 1: Contacts
    ws_contacts = wb.active
    ws_contacts.title = "Contacts"
    
    headers = [
        "Company", "Website", "First Name", "Last Name", "Full Name",
        "Role", "Email", "Email Type", "Phone", "Source URL", "Status"
    ]
    ws_contacts.append(headers)
    
    header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    
    for col_idx in range(1, len(headers) + 1):
        cell = ws_contacts.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
    
    contacts = job.get("contacts", [])
    for c in contacts:
        ws_contacts.append([
            c.get("company_name", ""),
            c.get("website", ""),
            c.get("first_name", ""),
            c.get("last_name", ""),
            c.get("full_name", ""),
            c.get("role", ""),
            c.get("email", ""),
            c.get("email_type", ""),
            c.get("phone", ""),
            c.get("source_url", ""),
            c.get("status", "Verified"),
        ])
        
    ws_contacts.freeze_panes = "A2"
    ws_contacts.auto_filter.ref = ws_contacts.dimensions
    
    # Auto-adjust column widths
    for col in ws_contacts.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws_contacts.column_dimensions[col_letter].width = max(max_len + 3, 12)
        
    # Sheet 2: Companies
    ws_comp = wb.create_sheet(title="Companies")
    comp_headers = ["Company Name", "Website", "Status", "Contacts Found", "Emails Found", "Pages Crawled"]
    ws_comp.append(comp_headers)
    for col_idx in range(1, len(comp_headers) + 1):
        c_cell = ws_comp.cell(row=1, column=col_idx)
        c_cell.font = header_font
        c_cell.fill = header_fill
        
    for w in job.get("websites", []):
        ws_comp.append([
            w.get("company_name", ""),
            w.get("url", ""),
            w.get("status", ""),
            w.get("contacts_found", 0),
            w.get("emails_found", 0),
            w.get("pages_crawled", 0),
        ])
    ws_comp.freeze_panes = "A2"
    
    # Sheet 3: Scraping Summary
    ws_summary = wb.create_sheet(title="Scraping Summary")
    ws_summary.append(["Metric", "Value"])
    ws_summary.cell(row=1, column=1).font = header_font
    ws_summary.cell(row=1, column=1).fill = header_fill
    ws_summary.cell(row=1, column=2).font = header_font
    ws_summary.cell(row=1, column=2).fill = header_fill
    
    ws_summary.append(["Job ID", job.get("id", "")])
    ws_summary.append(["Execution Date", job.get("created_at", "")])
    ws_summary.append(["Total Target Websites", job.get("total_websites", 0)])
    ws_summary.append(["Completed Websites", job.get("completed_websites", 0)])
    ws_summary.append(["Failed Websites", job.get("failed_websites", 0)])
    ws_summary.append(["Contacts Found", job.get("contacts_found", 0)])
    ws_summary.append(["Emails Found", job.get("emails_found", 0)])
    ws_summary.append(["Engine", "Website Contact Scraper v1.0 (Windows Native)"])

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()
