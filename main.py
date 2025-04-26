from flask import Flask, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import uuid
import datetime
from functools import wraps

app = Flask(__name__)


health_programs_db = {}
clients_db = {}
users_db = {
    "doctor1": {
        "username": "doctor1",
        "password_hash": generate_password_hash("securepassword123"),
        "role": "doctor"
    }
}

# API Authentication
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1]
            
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
            
        current_user = None
        for user in users_db.values():
            if user.get('token') == token:
                current_user = user
                break
                
        if not current_user:
            return jsonify({'message': 'Token is invalid!'}), 401
            
        return f(current_user, *args, **kwargs)
        
    return decorated

@app.route('/')
def home():
    return jsonify({'message': 'Welcome to the API!'})

@app.route('/favicon.ico')
def favicon():
    return '', 204  # No Content

@app.route('/login', methods=['POST'])
def login():
    auth = request.get_json()
    
    if not auth or not auth.get('username') or not auth.get('password'):
        return jsonify({'message': 'Could not verify'}), 401
        
    user = users_db.get(auth['username'])
    
    if not user:
        return jsonify({'message': 'User not found'}), 404
        
    if check_password_hash(user['password_hash'], auth['password']):
        token = str(uuid.uuid4())
        user['token'] = token
        return jsonify({'token': token})
        
    return jsonify({'message': 'Wrong credentials'}), 403

# Health Program 
@app.route('/programs', methods=['POST'])
@token_required
def create_program(current_user):
    """Create a new health program"""
    data = request.get_json()
    
    if not data or not data.get('name') or not data.get('description'):
        return jsonify({'message': 'Name and description are required'}), 400
        
    program_id = str(uuid.uuid4())
    health_programs_db[program_id] = {
        'id': program_id,
        'name': data['name'],
        'description': data.get('description', ''),
        'created_by': current_user['username']
    }
    
    return jsonify({'message': 'Program created', 'program_id': program_id}), 201

@app.route('/programs', methods=['GET'])
@token_required
def get_programs(current_user):
    """Get all health programs"""
    return jsonify(list(health_programs_db.values()))

# Client 
@app.route('/clients', methods=['POST'])
@token_required
def register_client(current_user):
    """Register a new client"""
    data = request.get_json()
    
    required_fields = ['first_name', 'last_name', 'date_of_birth']
    if not all(field in data for field in required_fields):
        return jsonify({'message': 'Missing required fields'}), 400
        
    client_id = str(uuid.uuid4())
    clients_db[client_id] = {
        'id': client_id,
        'first_name': data['first_name'],
        'last_name': data['last_name'],
        'date_of_birth': data['date_of_birth'],
        'contact_info': data.get('contact_info', {}),
        'medical_history': data.get('medical_history', ''),
        'enrolled_programs': [],
        'registered_by': current_user['username'],
        'registration_date': datetime.datetime.now().isoformat()
    }
    
    return jsonify({'message': 'Client registered', 'client_id': client_id}), 201

@app.route('/clients/search', methods=['GET'])
@token_required
def search_clients(current_user):
    """Search for clients by name"""
    query = request.args.get('q', '')
    
    if not query:
        return jsonify({'message': 'Search query is required'}), 400
        
    results = []
    for client in clients_db.values():
        if query.lower() in client['first_name'].lower() or query.lower() in client['last_name'].lower():
            # Return basic info for search results
            results.append({
                'id': client['id'],
                'first_name': client['first_name'],
                'last_name': client['last_name'],
                'date_of_birth': client['date_of_birth']
            })
    
    return jsonify(results)

@app.route('/clients/<client_id>', methods=['GET'])
@token_required
def get_client(current_user, client_id):
    """Get client details by ID"""
    client = clients_db.get(client_id)
    
    if not client:
        return jsonify({'message': 'Client not found'}), 404
        
    return jsonify(client)

@app.route('/clients/<client_id>/enroll', methods=['POST'])
@token_required
def enroll_client(current_user, client_id):
    """Enroll a client in health programs"""
    client = clients_db.get(client_id)
    
    if not client:
        return jsonify({'message': 'Client not found'}), 404
        
    data = request.get_json()
    
    if not data or not data.get('program_ids'):
        return jsonify({'message': 'Program IDs are required'}), 400
        
    for program_id in data['program_ids']:
        if program_id not in health_programs_db:
            return jsonify({'message': f'Program {program_id} not found'}), 404
            
        if program_id not in client['enrolled_programs']:
            client['enrolled_programs'].append(program_id)
    
    return jsonify({'message': 'Client enrolled in programs', 'client': client})

if __name__ == '__main__':
    app.run(debug=True, port=5001)