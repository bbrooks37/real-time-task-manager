// client/src/index.js

// --- Global Variables and DOM Elements ---
const API_BASE_URL = 'http://localhost:5000/api'; // Your backend API base URL
let socket; // Will hold the Socket.IO client instance
let currentUser = null; // Stores authenticated user data
let currentToken = null; // Stores the JWT token

const authSection = document.getElementById('auth-section');
const mainAppSection = document.getElementById('main-app-section');
const welcomeUsername = document.getElementById('welcome-username');
const logoutBtn = document.getElementById('logout-btn');
const globalMessageDiv = document.getElementById('global-message');

// Auth Form Elements
const registerForm = document.getElementById('register-form');
const loginForm = document.getElementById('login-form');
const showLoginBtn = document.getElementById('show-login-btn');
const showRegisterBtn = document.getElementById('show-register-btn');
const registerBtn = document.getElementById('register-btn');
const loginBtn = document.getElementById('login-btn');
const authMessageDiv = document.getElementById('auth-message');

// Project Elements
const projectsSection = document.getElementById('projects-section');
const createProjectForm = document.getElementById('create-project-form');
const projectNameInput = document.getElementById('project-name');
const projectsList = document.getElementById('projects-list');
const noProjectsMessage = document.getElementById('no-projects-message');

// Task Elements
const tasksSection = document.getElementById('tasks-section');
const currentProjectNameSpan = document.getElementById('current-project-name');
const createTaskForm = document.getElementById('create-task-form');
const taskTitleInput = document.getElementById('task-title');
const taskDescriptionInput = document.getElementById('task-description');
const taskDueDateInput = document.getElementById('task-due-date');
const taskPrioritySelect = document.getElementById('task-priority');
const taskStatusSelect = document.getElementById('task-status');
const taskAssignedToSelect = document.getElementById('task-assigned-to');
const taskProjectIdSelect = document.getElementById('task-project-id');
const taskParentTaskIdInput = document.getElementById('task-parent-task-id');
const tasksList = document.getElementById('tasks-list');
const noTasksMessage = document.getElementById('no-tasks-message');


// --- Utility Functions ---

function showMessage(message, type = 'success') {
    globalMessageDiv.textContent = message;
    globalMessageDiv.className = `fixed bottom-4 left-1/2 -translate-x-1/2 p-3 rounded-md shadow-lg message-fade ${
        type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-gray-800'
    } text-white`;
    globalMessageDiv.classList.remove('hidden');
    setTimeout(() => {
        globalMessageDiv.classList.add('hidden');
    }, 3000); // Message disappears after 3 seconds
}

function showAuthMessage(message, type = 'error') {
    authMessageDiv.textContent = message;
    authMessageDiv.className = `mt-4 text-center ${type === 'error' ? 'text-red-600' : 'text-green-600'}`;
}

function clearAuthMessages() {
    authMessageDiv.textContent = '';
}

function setAuthDisplay(showLogin = true) {
    if (showLogin) {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
    }
    clearAuthMessages();
}

// --- API Helper Function ---
async function fetchData(endpoint, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json',
    };
    if (currentToken) {
        headers['Authorization'] = `Bearer ${currentToken}`;
    }

    const options = { method, headers };
    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const data = await response.json();

        if (!response.ok) {
            // Handle HTTP errors
            throw new Error(data.message || 'Something went wrong');
        }
        return data;
    } catch (error) {
        console.error('API call error:', error);
        throw error; // Re-throw to be caught by specific handler
    }
}

// --- Authentication Functions ---

async function handleRegister(e) {
    e.preventDefault();
    const username = registerUsername.value;
    const email = registerEmail.value;
    const password = registerPassword.value;

    try {
        const data = await fetchData('/auth/register', 'POST', { username, email, password });
        showMessage('Registration successful! Please log in.', 'success');
        setAuthDisplay(true); // Show login form after successful registration
        registerUsername.value = ''; // Clear form
        registerEmail.value = '';
        registerPassword.value = '';
    } catch (error) {
        showAuthMessage(error.message);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = loginEmail.value;
    const password = loginPassword.value;

    try {
        const data = await fetchData('/auth/login', 'POST', { email, password });
        currentToken = data.token;
        currentUser = data.user;
        localStorage.setItem('jwt_token', currentToken); // Store token
        localStorage.setItem('current_user', JSON.stringify(currentUser)); // Store user info

        renderApp(); // Render main application UI
        showMessage('Logged in successfully!', 'success');
        loginEmail.value = ''; // Clear form
        loginPassword.value = '';
    } catch (error) {
        showAuthMessage(error.message);
    }
}

function handleLogout() {
    currentToken = null;
    currentUser = null;
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('current_user');
    location.reload(); // Simple refresh to reset UI
}

// --- Main Application Rendering ---

function renderApp() {
    if (currentToken && currentUser) {
        authSection.classList.add('hidden');
        mainAppSection.classList.remove('hidden');
        welcomeUsername.textContent = currentUser.username;
        initializeSocketIO(); // Initialize Socket.IO connection
        fetchProjects(); // Load projects
        fetchUsersForAssignment(); // Load users for task assignment dropdown
    } else {
        authSection.classList.remove('hidden');
        mainAppSection.classList.add('hidden');
        setAuthDisplay(true); // Show login form by default
    }
}

// --- Project Functions ---

async function fetchProjects() {
    try {
        const data = await fetchData('/projects');
        projectsList.innerHTML = ''; // Clear existing projects
        if (data.projects.length === 0) {
            noProjectsMessage.classList.remove('hidden');
        } else {
            noProjectsMessage.classList.add('hidden');
            data.projects.forEach(project => renderProject(project));
        }
        populateProjectDropdowns(data.projects); // Populate task assignment dropdown
    } catch (error) {
        showMessage(`Error fetching projects: ${error.message}`, 'error');
    }
}

function renderProject(project) {
    const projectDiv = document.createElement('div');
    projectDiv.id = `project-${project.id}`;
    projectDiv.className = 'bg-white p-4 rounded-md shadow-sm flex justify-between items-center border-l-4 border-purple-500';
    projectDiv.innerHTML = `
        <div>
            <h4 class="text-lg font-semibold text-gray-800">${project.name}</h4>
            <p class="text-sm text-gray-600">${project.description || 'No description'}</p>
        </div>
        <div class="flex space-x-2">
            <button data-id="${project.id}" class="view-tasks-btn bg-blue-500 text-white p-2 rounded-md text-sm hover:bg-blue-600 transition shadow-sm">View Tasks</button>
            <button data-id="${project.id}" data-name="${project.name}" data-description="${project.description || ''}" class="edit-project-btn bg-yellow-500 text-white p-2 rounded-md text-sm hover:bg-yellow-600 transition shadow-sm">Edit</button>
            <button data-id="${project.id}" class="delete-project-btn bg-red-500 text-white p-2 rounded-md text-sm hover:bg-red-600 transition shadow-sm">Delete</button>
        </div>
    `;
    projectsList.appendChild(projectDiv);

    // Attach event listeners for buttons
    projectDiv.querySelector('.view-tasks-btn').addEventListener('click', (e) => {
        fetchTasks(project.id, project.name);
    });
    projectDiv.querySelector('.edit-project-btn').addEventListener('click', (e) => {
        const projectId = e.target.dataset.id;
        const projectName = prompt('Edit Project Name:', e.target.dataset.name);
        const projectDesc = prompt('Edit Project Description:', e.target.dataset.description);
        if (projectName !== null) {
            updateProject(projectId, projectName, projectDesc);
        }
    });
    projectDiv.querySelector('.delete-project-btn').addEventListener('click', (e) => {
        const projectId = e.target.dataset.id;
        if (confirm('Are you sure you want to delete this project? This will also delete all associated tasks.')) {
            deleteProject(projectId);
        }
    });
}

async function handleCreateProject(e) {
    e.preventDefault();
    const name = projectNameInput.value;
    if (!name) {
        showMessage('Project name cannot be empty.', 'error');
        return;
    }
    try {
        await fetchData('/projects', 'POST', { name, description: '' }); // Description can be added later
        projectNameInput.value = '';
        showMessage('Project created!', 'success');
        // Project will be updated by Socket.IO event
    } catch (error) {
        showMessage(`Error creating project: ${error.message}`, 'error');
    }
}

async function updateProject(id, name, description) {
    try {
        await fetchData(`/projects/${id}`, 'PUT', { name, description });
        showMessage('Project updated!', 'success');
        // Project will be updated by Socket.IO event
    } catch (error) {
        showMessage(`Error updating project: ${error.message}`, 'error');
    }
}

async function deleteProject(id) {
    try {
        await fetchData(`/projects/${id}`, 'DELETE');
        showMessage('Project deleted!', 'success');
        // Project will be deleted by Socket.IO event
    } catch (error) {
        showMessage(`Error deleting project: ${error.message}`, 'error');
    }
}

function populateProjectDropdowns(projects) {
    taskProjectIdSelect.innerHTML = '<option value="">Select Project...</option>';
    projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        taskProjectIdSelect.appendChild(option);
    });
}

// --- User Functions (for task assignment) ---
let allUsers = []; // Store all users for dropdown
async function fetchUsersForAssignment() {
    try {
        // You'll need to create a simple API endpoint for getting all users
        // For now, let's assume '/users' endpoint exists and returns { users: [...] }
        // If not, you might only assign to users that already have projects/tasks
        const data = await fetchData('/users'); // Assuming you'll add this endpoint later
        allUsers = data.users;
        taskAssignedToSelect.innerHTML = '<option value="">Assign to...</option>';
        allUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.username;
            taskAssignedToSelect.appendChild(option);
        });
    } catch (error) {
        console.warn('Could not fetch users for assignment. Skipping user dropdown population. Error:', error.message);
        // Fallback or just ignore if /users endpoint is not critical yet
    }
}

// --- Task Functions ---

async function fetchTasks(projectId = null, projectName = 'All Projects') {
    currentProjectNameSpan.textContent = projectName;
    const endpoint = projectId ? `/tasks?project_id=${projectId}` : '/tasks';
    try {
        const data = await fetchData(endpoint);
        tasksList.innerHTML = ''; // Clear existing tasks
        if (data.tasks.length === 0) {
            noTasksMessage.classList.remove('hidden');
        } else {
            noTasksMessage.classList.add('hidden');
            data.tasks.forEach(task => renderTask(task));
        }
    } catch (error) {
        showMessage(`Error fetching tasks: ${error.message}`, 'error');
    }
}

function renderTask(task) {
    const taskDiv = document.createElement('div');
    taskDiv.id = `task-${task.id}`;
    taskDiv.className = 'bg-white p-4 rounded-md shadow-sm flex justify-between items-start border-l-4 border-yellow-500';

    const tagsHtml = task.tags ? task.tags.map(tag => `<span class="inline-block bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-2">${tag.name}</span>`).join('') : '';

    taskDiv.innerHTML = `
        <div class="flex-grow">
            <h4 class="text-lg font-semibold text-gray-800">${task.title}</h4>
            <p class="text-sm text-gray-600 mb-2">${task.description || 'No description'}</p>
            <p class="text-xs text-gray-500 mb-2">
                Due: ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'N/A'} |
                Priority: <span class="font-medium text-${getPriorityColor(task.priority)}">${task.priority}</span> |
                Status: <span class="font-medium text-${getStatusColor(task.status)}">${task.status}</span>
            </p>
            <p class="text-xs text-gray-500 mb-2">
                Project: ${task.project_name || 'N/A'} | Assigned To: ${task.assigned_to_username || 'Unassigned'}
            </p>
            <div class="mt-2">${tagsHtml}</div>
        </div>
        <div class="flex flex-col space-y-2 ml-4">
            <button data-id="${task.id}" data-project-id="${task.project_id}" class="edit-task-btn bg-yellow-500 text-white p-2 rounded-md text-sm hover:bg-yellow-600 transition shadow-sm">Edit</button>
            <button data-id="${task.id}" class="delete-task-btn bg-red-500 text-white p-2 rounded-md text-sm hover:bg-red-600 transition shadow-sm">Delete</button>
        </div>
    `;
    tasksList.appendChild(taskDiv);

    // Attach event listeners
    taskDiv.querySelector('.edit-task-btn').addEventListener('click', (e) => {
        const taskId = e.target.dataset.id;
        const projectId = e.target.dataset.projectId; // Pass project ID for update
        // A more advanced edit would involve a modal with pre-filled fields
        const newTitle = prompt('Edit Task Title:', task.title);
        if (newTitle !== null) {
            updateTask(taskId, { title: newTitle, project_id: projectId }); // Only update title for simplicity
        }
    });
    taskDiv.querySelector('.delete-task-btn').addEventListener('click', (e) => {
        const taskId = e.target.dataset.id;
        if (confirm('Are you sure you want to delete this task?')) {
            deleteTask(taskId);
        }
    });
}

async function handleCreateTask(e) {
    e.preventDefault();
    const title = taskTitleInput.value;
    const description = taskDescriptionInput.value;
    const due_date = taskDueDateInput.value || null;
    const priority = taskPrioritySelect.value;
    const status = taskStatusSelect.value;
    const assigned_to = taskAssignedToSelect.value || null;
    const project_id = taskProjectIdSelect.value;
    const parent_task_id = taskParentTaskIdInput.value || null;

    if (!title || !project_id) {
        showMessage('Task title and project must be selected.', 'error');
        return;
    }

    try {
        await fetchData('/tasks', 'POST', {
            title, description, due_date, priority, status,
            assigned_to: assigned_to ? parseInt(assigned_to) : null,
            project_id: parseInt(project_id),
            parent_task_id: parent_task_id ? parseInt(parent_task_id) : null
        });
        
        showMessage('Task created!', 'success');
        createTaskForm.reset(); // Clear form
        // Task list will be updated by Socket.IO event
    } catch (error) {
        showMessage(`Error creating task: ${error.message}`, 'error');
    }
}

async function updateTask(id, updates) {
    try {
        await fetchData(`/tasks/${id}`, 'PUT', updates);
        showMessage('Task updated!', 'success');
        // Task list will be updated by Socket.IO event
    } catch (error) {
        showMessage(`Error updating task: ${error.message}`, 'error');
    }
}

async function deleteTask(id) {
    try {
        await fetchData(`/tasks/${id}`, 'DELETE');
        showMessage('Task deleted!', 'success');
        // Task list will be updated by Socket.IO event
    } catch (error) {
        showMessage(`Error deleting task: ${error.message}`, 'error');
    }
}

// Helper for task colors
function getPriorityColor(priority) {
    switch (priority) {
        case 'urgent': return 'red-600';
        case 'high': return 'orange-600';
        case 'medium': return 'blue-600';
        case 'low': return 'green-600';
        default: return 'gray-600';
    }
}

function getStatusColor(status) {
    switch (status) {
        case 'completed': return 'green-600';
        case 'in-progress': return 'blue-600';
        case 'blocked': return 'red-600';
        case 'pending': return 'yellow-600';
        default: return 'gray-600';
    }
}

// --- Socket.IO Client Initialization ---
function initializeSocketIO() {
    if (socket && socket.connected) {
        console.log('Socket.IO already connected.');
        return;
    }

    // Connect to your backend's Socket.IO server
    socket = io(API_BASE_URL.replace('/api', ''), {
        // You can add auth headers here if needed, but for simplicity, we'll let auth happen via JWT for API calls.
        // For Socket.IO itself, you might pass the JWT if you secure socket connections
        // extraHeaders: {
        //     Authorization: `Bearer ${currentToken}`
        // }
    });

    socket.on('connect', () => {
        console.log(`Socket.IO: Connected to server with ID: ${socket.id}`);
        showMessage('Real-time connection established!', 'success');
    });

    socket.on('disconnect', () => {
        console.log('Socket.IO: Disconnected from server');
        showMessage('Real-time connection lost.', 'error');
    });

    socket.on('connect_error', (error) => {
        console.error('Socket.IO Connection Error:', error);
        showMessage('Real-time connection error.', 'error');
    });

    // --- Listen for Real-time Events from Backend ---

    socket.on('taskCreated', (data) => {
        showMessage(`New Task: "${data.task.title}" created!`, 'success');
        // Re-fetch tasks to update the list, or directly add/update the task
        fetchTasks(); 
        fetchProjects(); // Also refresh projects to update task counts if any
    });

    socket.on('taskUpdated', (data) => {
        showMessage(`Task: "${data.task.title}" updated!`, 'success');
        // Re-fetch tasks to update the list, or find and update the specific task element
        fetchTasks();
    });

    socket.on('taskDeleted', (data) => {
        showMessage(`Task deleted!`, 'success');
        // Remove task element from DOM, or re-fetch tasks
        fetchTasks();
    });

    socket.on('taskTagAdded', (data) => {
        showMessage(`Tag added to task!`, 'success');
        fetchTasks(); // Refresh tasks to show new tags
    });

    socket.on('taskTagRemoved', (data) => {
        showMessage(`Tag removed from task!`, 'success');
        fetchTasks(); // Refresh tasks to remove tags
    });

    socket.on('projectCreated', (data) => {
        showMessage(`New Project: "${data.project.name}" created!`, 'success');
        fetchProjects(); // Re-fetch projects to update list and dropdowns
    });

    socket.on('projectUpdated', (data) => {
        showMessage(`Project: "${data.project.name}" updated!`, 'success');
        fetchProjects(); // Re-fetch projects
    });

    socket.on('projectDeleted', (data) => {
        showMessage(`Project deleted!`, 'success');
        fetchProjects(); // Re-fetch projects
        fetchTasks(); // Also refresh tasks as tasks in deleted projects might be gone
    });

    // Example: A generic test event listener
    socket.on('test_response', (data) => {
        console.log('Received test_response:', data);
        showMessage(data.message, 'info');
    });
}


// --- Event Listeners ---

// Auth form toggles
showLoginBtn.addEventListener('click', () => setAuthDisplay(true));
showRegisterBtn.addEventListener('click', () => setAuthDisplay(false));

// Auth form submissions
registerBtn.addEventListener('click', handleRegister);
loginBtn.addEventListener('click', handleLogin);
logoutBtn.addEventListener('click', handleLogout);

// Project form submission
createProjectForm.addEventListener('submit', handleCreateProject);

// Task form submission
createTaskForm.addEventListener('submit', handleCreateTask);


// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    // Check for existing token/user in localStorage on page load
    currentToken = localStorage.getItem('jwt_token');
    currentUser = JSON.parse(localStorage.getItem('current_user'));

    renderApp(); // Render the appropriate section (auth or main app)
    fetchTasks(); // Initially load all tasks (without project filter)
});
