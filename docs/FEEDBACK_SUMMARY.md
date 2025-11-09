# AI-Powered Feedback Summary Feature

## Overview

The feedback summary feature provides AI-generated summaries of peer feedback for students in the evaluation wizard. This feature uses Ollama (a local LLM runtime) to generate tactful, concise summaries in Dutch that help students understand their peer feedback at a glance.

## Features

### For Students (Step 3 - Overzicht)

- **GCF Score**: Group Contribution Factor showing contribution relative to team average
- **SPR Score**: Self-Peer Ratio comparing self-assessment to peer feedback
- **OMZA Scores**: Category-based breakdown (if rubric has categories defined)
- **AI Summary**: Automatically generated summary of peer feedback (max 7 sentences)
- **Regenerate**: Option to generate a fresh summary
- **View Quotes**: Collapsible section showing anonymized peer feedback sources

### Data Protection

- **Anonymization**: All student names, emails, and direct references are removed before AI processing
- **Caching**: Summaries are cached based on feedback content hash to avoid unnecessary regeneration
- **Local Processing**: No external APIs - all AI processing happens on your own infrastructure
- **Privacy**: Raw feedback is never logged; only status, duration, and content hashes are stored

## Environment Variables

Configure the following environment variables for the backend:

```bash
# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434  # Default: http://localhost:11434
OLLAMA_MODEL=llama3.1                   # Default: llama3.1 (can also use mistral, etc.)
OLLAMA_TIMEOUT=10.0                     # Default: 10 seconds
```

## Setup

### 1. Install Ollama

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**macOS:**
```bash
brew install ollama
```

**Windows:**
Download from https://ollama.com/download

### 2. Pull Required Model

```bash
# Recommended: Llama 3.1 Instruct
ollama pull llama3.1

# Alternative: Mistral 7B Instruct
ollama pull mistral
```

### 3. Start Ollama Service

```bash
# Start Ollama (it runs as a background service)
ollama serve
```

The service will be available at `http://localhost:11434` by default.

### 4. Configure Backend

Set environment variables in your backend configuration:

```bash
# In your .env file or environment
export OLLAMA_BASE_URL=http://localhost:11434
export OLLAMA_MODEL=llama3.1
```

### 5. Run Database Migration

```bash
cd backend
alembic upgrade head
```

This creates the `feedback_summaries` table for caching.

## API Endpoints

### Get Student Summary
```
GET /api/v1/feedback-summaries/evaluation/{evaluation_id}/student/{student_id}
```

Returns cached or newly generated summary for a student.

**Response:**
```json
{
  "student_id": 123,
  "student_name": "Jan Jansen",
  "summary_text": "Je ontvangt positieve feedback over...",
  "generation_method": "ai",
  "feedback_count": 5,
  "cached": true
}
```

### Regenerate Summary
```
POST /api/v1/feedback-summaries/evaluation/{evaluation_id}/student/{student_id}/regenerate
```

Forces regeneration of the summary, bypassing cache.

### Get Feedback Quotes
```
GET /api/v1/feedback-summaries/evaluation/{evaluation_id}/student/{student_id}/quotes
```

Returns anonymized peer feedback quotes that were used as source material.

**Response:**
```json
{
  "quotes": [
    {
      "text": "Werkt goed samen en neemt initiatief",
      "criterion_id": 1
    }
  ],
  "count": 1
}
```

## Fallback Mechanism

If Ollama is unavailable or times out:

1. The system automatically falls back to a rule-based summary
2. The fallback summary is based on simple text analysis and templates
3. A badge indicates "Automatisch (fallback)" in the UI
4. Users can retry generation when Ollama is available again

## Summary Generation Guidelines

The AI is prompted to:

- Write in Dutch
- Use "je/jouw" form (informal, direct address)
- Maximum 7 sentences
- Mention 1-2 strengths and 1 area for attention
- Be tactful and constructive
- End with a concrete action suggestion
- Never include names or identifiable information
- Only state what is present in the feedback (no fabrication)

## Monitoring

The system tracks (without storing sensitive content):

- Number of summaries generated
- Average generation duration
- Error/timeout rates
- Fallback usage frequency
- Cache hit rates

Access this via the `feedback_summaries` table:

```sql
SELECT 
  generation_method,
  COUNT(*) as count,
  AVG(generation_duration_ms) as avg_duration_ms
FROM feedback_summaries
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY generation_method;
```

## Troubleshooting

### Summary Generation Fails

1. **Check Ollama is running:**
   ```bash
   curl http://localhost:11434/api/version
   ```

2. **Check model is available:**
   ```bash
   ollama list
   ```

3. **View Ollama logs:**
   ```bash
   # Linux/macOS
   journalctl -u ollama -f
   
   # Or check process logs
   ps aux | grep ollama
   ```

4. **Test model directly:**
   ```bash
   ollama run llama3.1 "Summarize: Good teamwork, needs more communication"
   ```

### Slow Generation

- Consider using a smaller/faster model like `mistral:7b`
- Increase timeout: `OLLAMA_TIMEOUT=120.0`
- Check server resources (CPU/RAM usage)
- Use GPU acceleration if available

### Cache Not Working

- Verify migration was applied: `alembic current`
- Check feedback content hasn't changed
- Review `feedback_summaries` table for entries

## Performance Tips

1. **Model Selection**: Smaller models (7B parameters) are faster but less nuanced
2. **Temperature**: Set to 0.3 for consistency (configured in OllamaService)
3. **GPU**: Use GPU-enabled Ollama for 5-10x speedup
4. **Batch Processing**: Generate summaries for all students during off-peak hours

## Security Considerations

- All processing happens locally (no external API calls)
- Names are stripped before AI processing
- Summaries are cached securely in your database
- No feedback content appears in application logs
- Only hashes and metadata are stored

## Future Enhancements

Potential improvements:

- Multi-language support
- Sentiment analysis badges
- Trend detection across evaluations
- Export summaries to PDF
- Email summaries to students
- Custom prompt templates per school
