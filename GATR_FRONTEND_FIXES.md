# GATR Frontend Fixes

## Issue 1: Internal Server Error Before LLM Response
**Problem**: Frontend throws timeout error before LLM has time to respond

**Solution**: 
- Added 2-minute (120 second) timeout to `repairTest()` API call
- Uses AbortController to handle timeout gracefully
- Shows user-friendly error message: "Request timeout - LLM is taking longer than expected. Please try again."

**Files Changed**:
- `frontend/src/lib/api/gatr.ts` - Added timeout handling with AbortController

## Issue 2: Unnecessary Input Fields
**Problem**: Form shows test_file, test_class, and other fields that aren't required

**Solution**:
- Simplified form to show only 3 required fields:
  1. Test Name (required)
  2. Broken Test Code (required)
  3. Error Message / Assertion (required)
- Made test_file and test_class truly optional with collapsible section
- Added "Show/Hide optional fields" toggle button
- Added clear labels with asterisks (*) for required fields
- Backend already handles optional fields correctly - only sends them if provided

**Files Changed**:
- `frontend/src/components/gatr/GATRPanel.tsx`:
  - Added `showOptionalFields` state
  - Reorganized form with labeled sections
  - Added collapsible optional fields section
  - Updated repair request to only send optional fields if provided

## Backend Verification
- Backend already correctly handles optional fields
- Only requires: `test_name`, `test_code`, `error_message`
- Optional fields: `test_file`, `test_class`, `line_number`, `project_name`

## Testing
1. Try submitting with only required fields (test name, code, error)
2. Verify optional fields can be expanded/collapsed
3. Test that LLM has 2 minutes to respond before timeout
4. Verify timeout shows user-friendly error message
