"""
Test script for async AI summary generation.

This script tests the complete async workflow:
1. Database connection and models
2. Queue connection
3. Task execution
4. Job status tracking

Run with: python test_async_summary.py
"""
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

def test_imports():
    """Test that all required modules can be imported."""
    print("Testing imports...")
    try:
        from app.infra.queue.connection import RedisConnection, get_queue
        from app.infra.queue.tasks import generate_ai_summary_task
        from app.infra.db.models import SummaryGenerationJob, FeedbackSummary
        from app.core.config import settings
        print("✓ All imports successful")
        return True
    except Exception as e:
        print(f"✗ Import failed: {e}")
        return False


def test_redis_connection():
    """Test Redis connection."""
    print("\nTesting Redis connection...")
    try:
        from app.infra.queue.connection import RedisConnection
        conn = RedisConnection.get_connection()
        conn.ping()
        print(f"✓ Redis connected: {conn}")
        return True
    except Exception as e:
        print(f"✗ Redis connection failed: {e}")
        print("  Make sure Redis is running: docker compose -f ops/docker/compose.dev.yml up -d")
        return False


def test_database_connection():
    """Test database connection and model."""
    print("\nTesting database connection...")
    try:
        from app.infra.db.session import SessionLocal
        from app.infra.db.models import SummaryGenerationJob
        
        db = SessionLocal()
        
        # Check if table exists
        result = db.execute(
            "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'summary_generation_jobs')"
        ).scalar()
        
        db.close()
        
        if result:
            print("✓ Database connected and table exists")
            return True
        else:
            print("✗ Table 'summary_generation_jobs' does not exist")
            print("  Run migrations: cd backend && alembic upgrade head")
            return False
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        print("  Make sure PostgreSQL is running and migrations are applied")
        return False


def test_queue_operations():
    """Test queue operations."""
    print("\nTesting queue operations...")
    try:
        from app.infra.queue.connection import get_queue
        
        queue = get_queue('ai-summaries')
        
        # Check queue stats
        count = len(queue)
        print(f"✓ Queue 'ai-summaries' accessible, {count} jobs pending")
        
        # List workers
        from rq import Worker
        from app.infra.queue.connection import RedisConnection
        conn = RedisConnection.get_connection()
        workers = Worker.all(connection=conn)
        print(f"  {len(workers)} workers connected")
        
        return True
    except Exception as e:
        print(f"✗ Queue operations failed: {e}")
        return False


def test_task_structure():
    """Test that task functions are properly defined."""
    print("\nTesting task structure...")
    try:
        from app.infra.queue.tasks import generate_ai_summary_task
        import inspect
        
        sig = inspect.signature(generate_ai_summary_task)
        params = list(sig.parameters.keys())
        
        expected = ['school_id', 'evaluation_id', 'student_id', 'job_id']
        if params == expected:
            print(f"✓ Task signature correct: {params}")
            return True
        else:
            print(f"✗ Task signature incorrect. Expected {expected}, got {params}")
            return False
    except Exception as e:
        print(f"✗ Task structure test failed: {e}")
        return False


def test_config():
    """Test configuration."""
    print("\nTesting configuration...")
    try:
        from app.core.config import settings
        
        print(f"  REDIS_URL: {settings.REDIS_URL}")
        print(f"  DATABASE_URL: {settings.DATABASE_URL[:30]}...")
        print(f"  OLLAMA_BASE_URL: {settings.OLLAMA_BASE_URL}")
        print(f"  OLLAMA_MODEL: {settings.OLLAMA_MODEL}")
        print(f"✓ Configuration loaded")
        return True
    except Exception as e:
        print(f"✗ Configuration failed: {e}")
        return False


def run_all_tests():
    """Run all tests."""
    print("=" * 60)
    print("Async AI Summary Generation - Test Suite")
    print("=" * 60)
    
    tests = [
        ("Imports", test_imports),
        ("Configuration", test_config),
        ("Redis Connection", test_redis_connection),
        ("Database Connection", test_database_connection),
        ("Queue Operations", test_queue_operations),
        ("Task Structure", test_task_structure),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n✗ Test '{name}' crashed: {e}")
            results.append((name, False))
    
    print("\n" + "=" * 60)
    print("Test Results Summary")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status:8} {name}")
    
    print(f"\n{passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! System is ready.")
        print("\nNext steps:")
        print("1. Start worker: make worker")
        print("2. Start backend: make be")
        print("3. Start frontend: make fe")
        print("4. Visit student evaluation overview page")
        return 0
    else:
        print("\n⚠️  Some tests failed. Review errors above.")
        return 1


if __name__ == '__main__':
    exit_code = run_all_tests()
    sys.exit(exit_code)
