"""
CSV sanitization utilities to prevent CSV injection attacks
"""


def sanitize_csv_value(value) -> str:
    """
    Sanitize a CSV cell value to prevent CSV injection attacks.
    
    CSV injection (also known as Formula Injection) occurs when a CSV cell
    starts with special characters like =, +, -, @, \t, \r which can be
    interpreted as formulas by spreadsheet applications (Excel, LibreOffice, etc.)
    
    This function prefixes such values with a single quote to neutralize them.
    
    Args:
        value: The value to sanitize (can be any type)
        
    Returns:
        Sanitized string value safe for CSV export
        
    Examples:
        >>> sanitize_csv_value("=1+1")
        "'=1+1"
        >>> sanitize_csv_value("+cmd|' /C calc'!A0")
        "'+cmd|' /C calc'!A0"
        >>> sanitize_csv_value("normal text")
        "normal text"
        >>> sanitize_csv_value(123)
        "123"
    """
    # Convert to string first
    if value is None:
        return ""
    
    str_value = str(value)
    
    # Check if the value starts with a potentially dangerous character
    if str_value and len(str_value) > 0:
        first_char = str_value[0]
        if first_char in ['=', '+', '-', '@', '\t', '\r']:
            # Prefix with single quote to neutralize the formula
            return "'" + str_value
    
    return str_value
