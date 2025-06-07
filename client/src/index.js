// client/src/index.js

// --- Global Variables ---
// Using hardcoded URL as we reverted from frontend bundlers like Webpack/Vite
const API_BASE_URL = 'http://localhost:5000/api'; 

let socket; 
let currentUser = null; 
let currentToken = null; 

// --- DOM Elements (will be assigned inside DOMContentLoaded) ---
let authSection, mainAppSection, welcomeUsername, logoutBtn;
let registerForm, loginForm, showLoginBtn, showRegisterBtn, registerBtn, loginBtn, authMessageDiv;
let projectsSection, createProjectForm, projectNameInput, projectsList, noProjectsMessage;
let tasksSection, currentProjectNameSpan, createTaskForm, taskTitleInput, taskDescriptionInput,
    taskDueDateInput, taskPrioritySelect, taskStatusSelect, taskAssignedToSelect,
    taskProjectIdSelect, taskParentTaskIdInput, tasksList, noTasksMessage;
let globalMessageDiv;

// Input fields for auth forms
let registerUsername, registerEmail, registerPassword; 
let loginEmail, loginPassword;                     

// Modal related DOM elements
let editTaskModal, editTaskForm, cancelEditTaskBtn;
let editTaskId, editTaskOriginalProjectId;
let editTaskTitle, editTaskDescription, editTaskDueDate, editTaskPrioritySelect, 
    editTaskStatusSelect, editTaskAssignedToSelect, editTaskProjectIdSelect, editTaskParentTaskIdInput;

// NEW: Edit Project Modal related DOM elements
let editProjectModal, editProjectForm, cancelEditProjectBtn;
let editProjectId, editProjectName, editProjectDescription;


// --- Utility Functions ---

function showMessage(message, type = 'success') {
    if (!globalMessageDiv) { 
        console.log("Message (globalMessageDiv not ready):", message);
        return;
    }
    globalMessageDiv.textContent = message;
    globalMessageDiv.className = `fixed bottom-4 left-1/2 -translate-x-1/2 p-3 rounded-md shadow-lg message-fade ${
        type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-gray-800'
    } text-white`;
    globalMessageDiv.classList.remove('hidden');
    setTimeout(() => {
        globalMessageDiv.classList.add('hidden');
    }, 3000); 
}

function showAuthMessage(message, type = 'error') {
    if (!authMessageDiv) { 
        console.log("Auth Message (authMessageDiv not ready):", message);
        return;
    }
    authMessageDiv.textContent = message;
    authMessageDiv.className = `mt-4 text-center ${type === 'error' ? 'text-red-600' : 'text-green-600'}`;
}

function clearAuthMessages() {
    if (authMessageDiv) { 
        authMessageDiv.textContent = '';
    }
}

function setAuthDisplay(showLogin = true) {
    if (loginForm && registerForm) { 
        if (showLogin) {
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
        } else {
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
        }
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
            throw new Error(data.message || 'Something went wrong');
        }
        return data;
    } catch (error) {
        console.error('API call error:', error);
        throw error; 
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
        setAuthDisplay(true); 
        registerUsername.value = ''; 
        registerEmail.value = '';
        registerPassword.value = '';
    } catch (error) {
        if (error.errors && Array.isArray(error.errors)) {
            const errorMessages = error.errors.map(err => err.msg).join('; ');
            showAuthMessage(`Validation failed: ${errorMessages}`);
        } else {
            showAuthMessage(error.message);
        }
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
        localStorage.setItem('jwt_token', currentToken); 
        localStorage.setItem('current_user', JSON.stringify(currentUser)); 

        renderApp(); 
        showMessage('Logged in successfully!', 'success');
        loginEmail.value = ''; 
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
    location.reload(); 
}

// --- Main Application Rendering ---

function renderApp() {
    if (currentToken && currentUser) {
        if (authSection && mainAppSection && welcomeUsername) {
            authSection.classList.add('hidden');
            mainAppSection.classList.remove('hidden');
            welcomeUsername.textContent = currentUser.username;
        }
        initializeSocketIO(); 
        fetchProjects(); 
        fetchUsersForAssignment(); 
        // Explicitly fetch all tasks for the logged-in user when rendering the app
        fetchTasks(); 
    } else {
        if (authSection && mainAppSection) {
            authSection.classList.remove('hidden');
            mainAppSection.classList.add('hidden');
        }
        setAuthDisplay(true); 
    }
}

// --- Project Functions ---

async function fetchProjects() {
    try {
        const data = await fetchData('/projects');
        if (projectsList) { 
            projectsList.innerHTML = ''; 
            if (data.projects.length === 0) {
                noProjectsMessage.classList.remove('hidden');
            } else {
                noProjectsMessage.classList.add('hidden');
                data.projects.forEach(project => renderProject(project));
            }
        }
        // Populate project dropdowns for both create AND edit forms
        populateProjectDropdowns(data.projects); 
        populateEditTaskProjectDropdown(data.projects); // Populate for edit task modal
    } catch (error) {
        showMessage(`Error fetching projects: ${error.message}`, 'error');
    }
}

function renderProject(project) {
    if (!projectsList) return; 
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

    projectDiv.querySelector('.view-tasks-btn').addEventListener('click', (e) => {
        fetchTasks(project.id, project.name);
    });
    // Attach event listener for the new edit project modal
    projectDiv.querySelector('.edit-project-btn').addEventListener('click', (e) => {
        const projectId = e.target.dataset.id;
        const projectName = e.target.dataset.name;
        const projectDescription = e.target.dataset.description;
        showEditProjectModal({ id: projectId, name: projectName, description: projectDescription });
    });
    projectDiv.querySelector('.delete-project-btn').addEventListener('click', (e) => {
        const projectId = e.target.dataset.id;
        // Use a custom modal instead of confirm for a better UX
        if (confirm('Are you sure you want to delete this project? This will also delete all associated tasks.')) {
            deleteProject(projectId);
        }
    });
}

// NEW: Function to show and populate the edit project modal
function showEditProjectModal(project) {
    if (!editProjectModal) return;

    editProjectId.value = project.id;
    editProjectName.value = project.name;
    editProjectDescription.value = project.description;

    editProjectModal.classList.remove('hidden'); // Show the modal
}

// NEW: Function to hide the edit project modal
function hideEditProjectModal() {
    if (editProjectModal) {
        editProjectModal.classList.add('hidden');
        editProjectForm.reset(); // Clear the form
    }
}

// NEW: Handle submission of the edit project form
async function handleEditProjectSubmit(e) {
    e.preventDefault();

    const projectId = editProjectId.value;
    const name = editProjectName.value;
    const description = editProjectDescription.value;

    const updates = { name, description };

    try {
        await updateProject(projectId, name, description); // Call existing updateProject function
        showMessage('Project updated successfully!', 'success');
        hideEditProjectModal(); // Hide the modal after success
    } catch (error) {
        showMessage(`Error updating project: ${error.message}`, 'error');
    }
}


async function handleCreateProject(e) {
    e.preventDefault();
    if (!projectNameInput) return; 
    const name = projectNameInput.value;
    if (!name) {
        showMessage('Project name cannot be empty.', 'error');
        return;
    }
    try {
        await fetchData('/projects', 'POST', { name, description: '' }); 
        projectNameInput.value = '';
        showMessage('Project created!', 'success');
    } catch (error) {
        showMessage(`Error creating project: ${error.message}`, 'error');
    }
}

async function updateProject(id, name, description) {
    try {
        await fetchData(`/projects/${id}`, 'PUT', { name, description });
        showMessage('Project updated!', 'success');
    } catch (error) {
        showMessage(`Error updating project: ${error.message}`, 'error');
    }
}

async function deleteProject(id) {
    try {
        await fetchData(`/projects/${id}`, 'DELETE');
        showMessage('Project deleted!', 'success');
    } catch (error) { 
        showMessage(`Error deleting project: ${error.message}`, 'error');
    }
}

function populateProjectDropdowns(projects) {
    if (!taskProjectIdSelect) return; 
    taskProjectIdSelect.innerHTML = '<option value="">Select Project...</option>';
    projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        taskProjectIdSelect.appendChild(option);
    });
}

// Populate project dropdown specifically for the edit task modal
function populateEditTaskProjectDropdown(projects) {
    if (!editTaskProjectIdSelect) return;
    editTaskProjectIdSelect.innerHTML = ''; 

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select Project...';
    editTaskProjectIdSelect.appendChild(defaultOption);

    projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        editTaskProjectIdSelect.appendChild(option);
    });
}


// --- User Functions (for task assignment) ---
let allUsers = []; 
async function fetchUsersForAssignment() {
    try {
        const data = await fetchData('/users'); 
        allUsers = data.users; 
        if (taskAssignedToSelect && editTaskAssignedToSelect) { // Also populate edit modal's dropdown
            taskAssignedToSelect.innerHTML = '<option value="">Assign to...</option>'; 
            editTaskAssignedToSelect.innerHTML = '<option value="">Assign to...</option>'; // For edit task modal
            allUsers.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id; 
                option.textContent = user.username; 
                taskAssignedToSelect.appendChild(option);
                editTaskAssignedToSelect.appendChild(option.cloneNode(true)); // Clone for the edit modal
            });
        }
    } catch (error) {
        console.warn('Could not fetch users for assignment. Skipping user dropdown population. Error:', error.message);
        showMessage(`Could not load users for assignment: ${error.message}`, 'error');
    }
}

// --- Task Functions ---

async function fetchTasks(projectId = null, projectName = 'All Projects') {
    if (currentProjectNameSpan) {
        currentProjectNameSpan.textContent = projectName;
    }
    const endpoint = projectId ? `/tasks?project_id=${projectId}` : '/tasks';
    try {
        const data = await fetchData(endpoint);
        if (tasksList) { 
            tasksList.innerHTML = ''; 
            if (data.tasks.length === 0) {
                noTasksMessage.classList.remove('hidden');
            } else {
                noTasksMessage.classList.add('hidden');
                data.tasks.forEach(task => renderTask(task));
            }
        }
    } catch (error) {
        if (currentToken) {
            showMessage(`Error fetching tasks: ${error.message}`, 'error');
        } else {
            console.warn(`Initial task fetch unauthorized (expected before login): ${error.message}`);
        }
    }
}

function renderTask(task) {
    if (!tasksList) return; 
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
            <button data-id="${task.id}" 
                    data-title="${task.title}" 
                    data-description="${task.description || ''}"
                    data-due-date="${task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : ''}"
                    data-priority="${task.priority}"
                    data-status="${task.status}"
                    data-assigned-to="${task.assigned_to || ''}"
                    data-project-id="${task.project_id}"
                    data-parent-task-id="${task.parent_task_id || ''}"
                    class="edit-task-btn bg-yellow-500 text-white p-2 rounded-md text-sm hover:bg-yellow-600 transition shadow-sm">Edit</button>
            <button data-id="${task.id}" class="delete-task-btn bg-red-500 text-white p-2 rounded-md text-sm hover:bg-red-600 transition shadow-sm">Delete</button>
        </div>
    `;
    tasksList.appendChild(taskDiv);

    // Attach event listeners for edit task modal
    taskDiv.querySelector('.edit-task-btn').addEventListener('click', (e) => {
        const taskId = e.target.dataset.id;
        const taskData = {
            id: taskId,
            title: e.target.dataset.title,
            description: e.target.dataset.description,
            due_date: e.target.dataset.dueDate, 
            priority: e.target.dataset.priority,
            status: e.target.dataset.status,
            assigned_to: e.target.dataset.assignedTo,
            project_id: e.target.dataset.projectId,
            parent_task_id: e.target.dataset.parentTaskId,
        };
        showEditTaskModal(taskData); 
    });
    taskDiv.querySelector('.delete-task-btn').addEventListener('click', (e) => {
        const taskId = e.target.dataset.id;
        if (confirm('Are you sure you want to delete this task?')) {
            deleteTask(taskId);
        }
    });
}

// Function to show and populate the edit task modal
function showEditTaskModal(task) {
    if (!editTaskModal) return;

    editTaskId.value = task.id;
    editTaskOriginalProjectId.value = task.project_id; 

    editTaskTitle.value = task.title;
    editTaskDescription.value = task.description;
    editTaskDueDate.value = task.due_date; 
    editTaskPrioritySelect.value = task.priority;
    editTaskStatusSelect.value = task.status;
    
    editTaskAssignedToSelect.value = task.assigned_to || ''; 
    editTaskProjectIdSelect.value = task.project_id || '';

    editTaskParentTaskIdInput.value = task.parent_task_id;

    editTaskModal.classList.remove('hidden'); 
}

// Function to hide the edit task modal
function hideEditTaskModal() {
    if (editTaskModal) {
        editTaskModal.classList.add('hidden');
        editTaskForm.reset(); 
    }
}

// Handle submission of the edit task form
async function handleEditTaskSubmit(e) {
    e.preventDefault();

    const taskId = editTaskId.value;
    const originalProjectId = editTaskOriginalProjectId.value; 

    const updates = {
        title: editTaskTitle.value,
        description: editTaskDescription.value,
        due_date: editTaskDueDate.value || null,
        priority: editTaskPrioritySelect.value,
        status: editTaskStatusSelect.value,
        assigned_to: editTaskAssignedToSelect.value ? parseInt(editTaskAssignedToSelect.value) : null,
        project_id: editTaskProjectIdSelect.value ? parseInt(editTaskProjectIdSelect.value) : null, 
        parent_task_id: editTaskParentTaskIdInput.value ? parseInt(editTaskParentTaskIdInput.value) : null,
    };

    try {
        await updateTask(taskId, updates); 
        showMessage('Task updated successfully!', 'success');
        hideEditTaskModal(); 
    } catch (error) {
        showMessage(`Error updating task: ${error.message}`, 'error');
    }
}


async function handleCreateTask(e) {
    e.preventDefault();
    if (!taskTitleInput || !taskProjectIdSelect) return; 
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
        createTaskForm.reset(); 
    }
    catch (error) {
        showMessage(`Error creating task: ${error.message}`, 'error');
    }
}

async function updateTask(id, updates) {
    try {
        if (updates.assigned_to !== undefined && updates.assigned_to !== null) {
            updates.assigned_to = updates.assigned_to ? parseInt(updates.assigned_to) : null;
        }
        await fetchData(`/tasks/${id}`, 'PUT', updates);
        showMessage('Task updated!', 'success');
    } catch (error) {
        showMessage(`Error updating task: ${error.message}`, 'error');
    }
}

async function deleteTask(id) {
    try {
        await fetchData(`/tasks/${id}`, 'DELETE');
        showMessage('Task deleted!', 'success');
    } catch (error) {
        showMessage(`Error deleting task: ${error.message}`, 'error');
    }
}

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

    socket = io(API_BASE_URL.replace('/api', ''), {
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
        fetchTasks(); 
        fetchProjects(); 
    });

    socket.on('taskUpdated', (data) => {
        showMessage(`Task: "${data.task.title}" updated!`, 'success');
        fetchTasks();
    });

    socket.on('taskDeleted', (data) => {
        showMessage(`Task deleted!`, 'success');
        fetchTasks();
    });

    socket.on('taskTagAdded', (data) => {
        showMessage(`Tag added to task!`, 'success');
        fetchTasks(); 
    });

    socket.on('taskTagRemoved', (data) => {
        showMessage(`Tag removed from task!`, 'success');
        fetchTasks(); 
    });

    socket.on('projectCreated', (data) => {
        showMessage(`New Project: "${data.project.name}" created!`, 'success');
        fetchProjects(); 
    });

    socket.on('projectUpdated', (data) => {
        showMessage(`Project: "${data.project.name}" updated!`, 'success');
        fetchProjects(); 
    });

    socket.on('projectDeleted', (data) => {
        showMessage(`Project deleted!`, 'success');
        fetchProjects(); 
        fetchTasks(); 
    });

    socket.on('test_response', (data) => {
        console.log('Received test_response:', data);
        showMessage(data.message, 'info');
    });
}


// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Assign DOM elements
    authSection = document.getElementById('auth-section');
    mainAppSection = document.getElementById('main-app-section');
    welcomeUsername = document.getElementById('welcome-username');
    logoutBtn = document.getElementById('logout-btn');
    globalMessageDiv = document.getElementById('global-message');

    // Auth Form Elements
    registerForm = document.getElementById('register-form');
    loginForm = document.getElementById('login-form');
    showLoginBtn = document.getElementById('show-login-btn');
    showRegisterBtn = document.getElementById('show-register-btn');
    registerBtn = document.getElementById('register-btn');
    loginBtn = document.getElementById('login-btn');
    authMessageDiv = document.getElementById('auth-message');
    registerUsername = document.getElementById('register-username'); 
    registerEmail = document.getElementById('register-email');     
    registerPassword = document.getElementById('register-password'); 
    loginEmail = document.getElementById('login-email');         
    loginPassword = document.getElementById('login-password');     

    // Project Elements
    projectsSection = document.getElementById('projects-section');
    createProjectForm = document.getElementById('create-project-form');
    projectNameInput = document.getElementById('project-name');
    projectsList = document.getElementById('projects-list');
    noProjectsMessage = document.getElementById('no-projects-message');

    // Task Elements (main form)
    tasksSection = document.getElementById('tasks-section');
    currentProjectNameSpan = document.getElementById('current-project-name');
    createTaskForm = document.getElementById('create-task-form');
    taskTitleInput = document.getElementById('task-title');
    taskDescriptionInput = document.getElementById('task-description');
    taskDueDateInput = document.getElementById('task-due-date');
    taskPrioritySelect = document.getElementById('task-priority');
    taskStatusSelect = document.getElementById('task-status');
    taskAssignedToSelect = document.getElementById('task-assigned-to'); 
    taskProjectIdSelect = document.getElementById('task-project-id');
    taskParentTaskIdInput = document.getElementById('task-parent-task-id');
    tasksList = document.getElementById('tasks-list');
    noTasksMessage = document.getElementById('no-tasks-message');

    // Edit Task Modal Elements
    editTaskModal = document.getElementById('edit-task-modal');
    editTaskForm = document.getElementById('edit-task-form');
    cancelEditTaskBtn = document.getElementById('cancel-edit-task-btn');
    editTaskId = document.getElementById('edit-task-id');
    editTaskOriginalProjectId = document.getElementById('edit-task-original-project-id');
    editTaskTitle = document.getElementById('edit-task-title');
    editTaskDescription = document.getElementById('edit-task-description');
    editTaskDueDate = document.getElementById('edit-task-due-date');
    editTaskPrioritySelect = document.getElementById('edit-task-priority');
    editTaskStatusSelect = document.getElementById('edit-task-status');
    editTaskAssignedToSelect = document.getElementById('edit-task-assigned-to');
    editTaskProjectIdSelect = document.getElementById('edit-task-project-id');
    editTaskParentTaskIdInput = document.getElementById('edit-task-parent-task-id');

    // NEW: Edit Project Modal Elements
    editProjectModal = document.getElementById('edit-project-modal');
    editProjectForm = document.getElementById('edit-project-form');
    cancelEditProjectBtn = document.getElementById('cancel-edit-project-btn');
    editProjectId = document.getElementById('edit-project-id');
    editProjectName = document.getElementById('edit-project-name');
    editProjectDescription = document.getElementById('edit-project-description');


    // Attach Event Listeners
    showLoginBtn.addEventListener('click', () => setAuthDisplay(true));
    showRegisterBtn.addEventListener('click', () => setAuthDisplay(false));

    registerBtn.addEventListener('click', handleRegister);
    loginBtn.addEventListener('click', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);

    createProjectForm.addEventListener('submit', handleCreateProject);
    createTaskForm.addEventListener('submit', handleCreateTask);
    
    // Event listeners for the edit task modal
    editTaskForm.addEventListener('submit', handleEditTaskSubmit);
    cancelEditTaskBtn.addEventListener('click', hideEditTaskModal);
    editTaskModal.addEventListener('click', (e) => {
        if (e.target === editTaskModal) {
            hideEditTaskModal();
        }
    });

    // NEW: Event listeners for the edit project modal
    editProjectForm.addEventListener('submit', handleEditProjectSubmit);
    cancelEditProjectBtn.addEventListener('click', hideEditProjectModal);
    editProjectModal.addEventListener('click', (e) => {
        if (e.target === editProjectModal) {
            hideEditProjectModal();
        }
    });

    // Check for existing token/user in localStorage on page load
    currentToken = localStorage.getItem('jwt_token');
    currentUser = JSON.parse(localStorage.getItem('current_user'));

    renderApp(); 
    if (!currentToken) {
        console.warn("Not logged in. Initial task fetch will be unauthorized (expected).");
    }
});
