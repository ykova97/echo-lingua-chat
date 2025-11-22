# Guest Session API Documentation

## Overview
This API allows unauthenticated clients (guests) to join conversations using a share token. It's designed to be called from web browsers or mobile apps (Flutter) without requiring user authentication.

## Endpoint: `create-guest-session-from-token`

### Base URL
```
https://zakhdgsapuahjuqsbsfd.supabase.co/functions/v1/create-guest-session-from-token
```

### Authentication
**No authentication required** - This is a public endpoint accessible to anyone.

### Rate Limiting
- **10 requests per minute per IP address**
- Returns `429` status code when limit exceeded

### Request

**Method:** `POST`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "token": "string (required)",
  "display_name": "string (optional, max 100 chars)"
}
```

**Parameters:**
- `token` (required): The share token received from the QR code or share link
- `display_name` (optional): The name to display for the guest user. Defaults to "Guest" if not provided

### Response

#### Success (200 OK)
```json
{
  "conversation_id": "uuid",
  "guest_id": "uuid"
}
```

#### Error Responses

**Invalid or Expired Token (404 Not Found or 410 Gone)**
```json
{
  "error": "invalid_or_expired",
  "message": "Token not found or invalid"
}
```

Possible reasons:
- Token doesn't exist
- Token has expired (> 24 hours old)
- Token has reached maximum uses

**Invalid Input (400 Bad Request)**
```json
{
  "error": "invalid_input",
  "message": "Token is required and must be a string"
}
```

**Rate Limit Exceeded (429 Too Many Requests)**
```json
{
  "error": "rate_limit_exceeded",
  "message": "Rate limit exceeded. Max 10 requests per minute."
}
```

**Server Error (500 Internal Server Error)**
```json
{
  "error": "server_error",
  "message": "Error details..."
}
```

## Flutter Integration Example

### 1. Install Dependencies
```yaml
dependencies:
  http: ^1.1.0
```

### 2. Create Guest Session Service

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class GuestSessionService {
  static const String baseUrl = 
    'https://zakhdgsapuahjuqsbsfd.supabase.co/functions/v1';
  
  Future<GuestSessionResponse> createGuestSession({
    required String token,
    String? displayName,
  }) async {
    final url = Uri.parse('$baseUrl/create-guest-session-from-token');
    
    try {
      final response = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'token': token.trim(),
          if (displayName != null) 'display_name': displayName.trim(),
        }),
      );
      
      final data = jsonDecode(response.body);
      
      if (response.statusCode == 200) {
        return GuestSessionResponse(
          conversationId: data['conversation_id'],
          guestId: data['guest_id'],
        );
      } else {
        throw GuestSessionException(
          errorCode: data['error'] ?? 'unknown_error',
          message: data['message'] ?? 'An error occurred',
          statusCode: response.statusCode,
        );
      }
    } catch (e) {
      if (e is GuestSessionException) rethrow;
      throw GuestSessionException(
        errorCode: 'network_error',
        message: 'Failed to connect to server: $e',
        statusCode: 0,
      );
    }
  }
}

class GuestSessionResponse {
  final String conversationId;
  final String guestId;
  
  GuestSessionResponse({
    required this.conversationId,
    required this.guestId,
  });
}

class GuestSessionException implements Exception {
  final String errorCode;
  final String message;
  final int statusCode;
  
  GuestSessionException({
    required this.errorCode,
    required this.message,
    required this.statusCode,
  });
  
  @override
  String toString() => message;
}
```

### 3. Usage Example

```dart
class GuestJoinScreen extends StatefulWidget {
  final String shareToken;
  
  const GuestJoinScreen({required this.shareToken});
  
  @override
  State<GuestJoinScreen> createState() => _GuestJoinScreenState();
}

class _GuestJoinScreenState extends State<GuestJoinScreen> {
  final _service = GuestSessionService();
  final _nameController = TextEditingController();
  bool _isLoading = false;
  String? _error;
  
  Future<void> _joinConversation() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    
    try {
      final result = await _service.createGuestSession(
        token: widget.shareToken,
        displayName: _nameController.text.isNotEmpty 
          ? _nameController.text 
          : null,
      );
      
      // Navigate to chat screen
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => ChatScreen(
            conversationId: result.conversationId,
            guestId: result.guestId,
          ),
        ),
      );
    } on GuestSessionException catch (e) {
      setState(() {
        _error = _getErrorMessage(e.errorCode);
      });
    } catch (e) {
      setState(() {
        _error = 'An unexpected error occurred';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }
  
  String _getErrorMessage(String errorCode) {
    switch (errorCode) {
      case 'invalid_or_expired':
        return 'This invite link is invalid or has expired';
      case 'rate_limit_exceeded':
        return 'Too many requests. Please wait a moment and try again';
      case 'invalid_input':
        return 'Invalid input. Please check your data';
      default:
        return 'Failed to join conversation. Please try again';
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Join Conversation')),
      body: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          children: [
            TextField(
              controller: _nameController,
              decoration: InputDecoration(
                labelText: 'Your Name (optional)',
                hintText: 'What should we call you?',
              ),
              maxLength: 100,
            ),
            SizedBox(height: 16),
            if (_error != null)
              Text(_error!, style: TextStyle(color: Colors.red)),
            SizedBox(height: 16),
            ElevatedButton(
              onPressed: _isLoading ? null : _joinConversation,
              child: _isLoading 
                ? CircularProgressIndicator() 
                : Text('Join'),
            ),
          ],
        ),
      ),
    );
  }
}
```

## React/TypeScript Integration

Use the provided utility function:

```typescript
import { createGuestSession } from "@/lib/createGuestSession";

try {
  const result = await createGuestSession({
    token: "your-token-here",
    display_name: "John Doe", // optional
  });
  
  console.log("Conversation ID:", result.conversation_id);
  console.log("Guest ID:", result.guest_id);
  
  // Navigate to chat or store the IDs
} catch (error) {
  console.error("Failed to join:", error.message);
}
```

## Testing

A test page is available at `/guest-session-test` for manual testing of the API.

## Security Features

1. **Input Validation**: All inputs are validated for type, length, and format
2. **Rate Limiting**: 10 requests per minute per IP to prevent abuse
3. **Token Expiration**: Tokens expire after 24 hours
4. **Usage Limits**: Each token has a maximum number of uses (default: 10)
5. **No Sensitive Data Logging**: Tokens and user data are not logged in full

## Token Lifecycle

1. User generates a share link via `/generate-share-link` (authenticated)
2. Share token is created with 24-hour expiration and max 10 uses
3. Guest receives the token via QR code or link
4. Guest calls `create-guest-session-from-token` with the token
5. System validates token, creates guest session, and conversation
6. Token's `used_count` is incremented
7. Guest can join the conversation using the returned IDs

## Notes

- Guest sessions expire after 24 hours
- Conversations created via guest sessions are marked as ephemeral
- The token cannot be reused after reaching `max_uses`
- Each successful call creates a new guest session and conversation
