// client/src/index.js

// --- Global Variables ---
// Dynamically determine API_BASE_URL using Webpack's process.env
const API_BASE_URL = process.env.API_BASE_URL; 

let socket; 
let currentUser = null; 
let currentToken = null; 
let allTags = []; // Store all available tags
let currentProjectIdFilter = null; // To keep track of the currently selected project for filtering

// --- DOM Elements (will be assigned inside DOMContentLoaded) ---
let authSection, mainAppSection, welcomeUsername, logoutBtn;
let registerForm, loginForm, showLoginBtn, showRegisterBtn, registerBtn, loginBtn, authMessageDiv;
let projectsSection, createProjectForm, projectNameInput, projectsList, noProjectsMessage;
let tasksSection, currentProjectNameSpan, createTaskForm, taskTitleInput, taskDescriptionInput,
    taskDueDateInput, taskPrioritySelect, taskStatusSelect, taskAssignedToSelect,
    taskProjectIdSelect, taskParentTaskIdInput, tasksList, noTasksMessage;
let globalMessageDiv;
// NEW: Notification related DOM elements
let notificationsContainer, notificationsList, notificationsBadge, clearNotificationsBtn;

// Input fields for auth forms
let registerUsername, registerEmail, registerPassword; 
let loginEmail, loginPassword;                     

// Modal related DOM elements (Task)
let editTaskModal, editTaskForm, cancelEditTaskBtn;
let editTaskId, editTaskOriginalProjectId;
let editTaskTitle, editTaskDescription, editTaskDueDate, editTaskPrioritySelect, 
    editTaskStatusSelect, editTaskAssignedToSelect, editTaskProjectIdSelect, editTaskParentTaskIdInput;
let editTaskTagsSelect; // Multi-select for tags in edit task modal
let taskTagsSelect; // Multi-select for tags in create task form
let editTaskOriginalTagsInput; // Hidden input to store original tags for comparison

// Edit Project Modal related DOM elements
let editProjectModal, editProjectForm, cancelEditProjectBtn;
let editProjectId, editProjectName, editProjectDescription;

// Tag Management DOM elements
let tagsSection, createTagForm, tagNameInput, tagsList, noTagsMessage;

// Task Filter DOM elements
let taskFilterSearchInput, taskFilterPrioritySelect, taskFilterStatusSelect,
    taskFilterAssignedToSelect, taskFilterTagsSelect, applyFiltersBtn, clearFiltersBtn;
let taskFilterDueDateStart, taskFilterDueDateEnd, taskFilterOrderBy, taskFilterOrderDirection;


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

// Updated showAuthMessage to handle validation errors from backend
function showAuthMessage(errorData, type = 'error') {
    if (!authMessageDiv) { 
        console.log("Auth Message (authMessageDiv not ready):", errorData);
        return;
    }
    let messageToDisplay = '';
    if (errorData.errors && Array.isArray(errorData.errors)) {
        // Display validation errors specifically
        messageToDisplay = errorData.errors.map(err => err.msg).join('; ');
    } else if (errorData.message) {
        // Display general error message
        messageToDisplay = errorData.message;
    } else {
        messageToDisplay = 'An unknown error occurred during authentication.';
    }

    authMessageDiv.textContent = messageToDisplay;
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
        const data = await response.json(); // Always try to parse JSON, even on error

        if (!response.ok) {
            // Pass the entire error data, including 'errors' array if present
            throw data; // Throw the parsed error object
        }
        return data;
    } catch (error) {
        console.error('API call error:', error);
        // If it's a TypeError (e.g., Failed to fetch), or other network errors
        // that don't return JSON, create a generic error object.
        if (error instanceof TypeError) {
            throw { message: 'Network error or server unreachable. Please try again.' };
        }
        throw error; // Re-throw the parsed error object or generic error
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
        // Pass the full error object to showAuthMessage
        showAuthMessage(error); 
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
        // Pass the full error object to showAuthMessage
        showAuthMessage(error);
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
        fetchTags(); // Fetch all tags on app load
        fetchTasks(); // Initial fetch of tasks with no filters
        fetchNotifications(); // NEW: Fetch notifications on app load
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
    // Show a visual cue if project is soft-deleted (for admin view)
    const borderColor = project.is_deleted ? 'border-red-700' : 'border-purple-500';
    const bgColor = project.is_deleted ? 'bg-red-100' : 'bg-white';

    projectDiv.className = `${bgColor} p-4 rounded-md shadow-sm flex justify-between items-center border-l-4 ${borderColor}`;
    projectDiv.innerHTML = `
        <div>
            <h4 class="text-lg font-semibold text-gray-800">${project.name} ${project.is_deleted ? '(Deleted)' : ''}</h4>
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
        currentProjectIdFilter = project.id; // Set filter for tasks
        fetchTasks(project.id, project.name);
    });
    // Attach event listener for the new edit project modal
    const editBtn = projectDiv.querySelector('.edit-project-btn');
    editBtn.addEventListener('click', (e) => {
        const projectId = e.target.dataset.id;
        const projectName = e.target.dataset.name;
        const projectDescription = e.target.dataset.description;
        showEditProjectModal({ id: projectId, name: projectName, description: projectDescription });
    });

    const deleteBtn = projectDiv.querySelector('.delete-project-btn');
    deleteBtn.addEventListener('click', (e) => {
        const projectId = e.target.dataset.id;
        // Conditional rendering/disabling based on user role (e.g., only admin or project creator can delete)
        const projectCreatorId = project.created_by; // Assuming 'created_by' is returned in project object
        if (currentUser.role === 'admin' || currentUser.user_id === projectCreatorId) {
            if (confirm(`Are you sure you want to delete project "${project.name}"? This will also soft-delete all associated tasks.`)) {
                deleteProject(projectId);
            }
        } else {
            showMessage('You do not have permission to delete this project.', 'error');
            deleteBtn.disabled = true; // Disable button if not authorized
            deleteBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    });
    // Disable edit/delete buttons if project is soft-deleted or user has no permission
    if (project.is_deleted || (currentUser.role !== 'admin' && currentUser.user_id !== project.created_by)) {
        editBtn.disabled = true;
        editBtn.classList.add('opacity-50', 'cursor-not-allowed');
        deleteBtn.disabled = true;
        deleteBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

// Function to show and populate the edit project modal
function showEditProjectModal(project) {
    if (!editProjectModal) return;

    editProjectId.value = project.id;
    editProjectName.value = project.name;
    editProjectDescription.value = project.description;

    editProjectModal.classList.remove('hidden'); // Show the modal
}

// Function to hide the edit project modal
function hideEditProjectModal() {
    if (editProjectModal) {
        editProjectModal.classList.add('hidden');
        editProjectForm.reset(); // Clear the form
    }
}

// Handle submission of the edit project form
async function handleEditProjectSubmit(e) {
    e.preventDefault();

    const projectId = editProjectId.value;
    const name = editProjectName.value;
    const description = editProjectDescription.value;

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
    // Filter out soft-deleted projects from dropdowns
    const activeProjects = projects.filter(p => !p.is_deleted);
    activeProjects.forEach(project => {
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

    // Filter out soft-deleted projects from dropdowns
    const activeProjects = projects.filter(p => !p.is_deleted);
    activeProjects.forEach(project => {
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
        if (taskAssignedToSelect && editTaskAssignedToSelect && taskFilterAssignedToSelect) { // Also populate edit modal's dropdown and filter dropdown
            taskAssignedToSelect.innerHTML = '<option value="">Assign to...</option>'; 
            editTaskAssignedToSelect.innerHTML = '<option value="">Assign to...</option>'; // For edit task modal
            taskFilterAssignedToSelect.innerHTML = '<option value="">All Assignees</option>'; // For task filter

            allUsers.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id; 
                option.textContent = user.username; 
                taskAssignedToSelect.appendChild(option);
                editTaskAssignedToSelect.appendChild(option.cloneNode(true)); // Clone for the edit modal
                taskFilterAssignedToSelect.appendChild(option.cloneNode(true)); // Clone for the filter dropdown
            });
        }
    } catch (error) {
        console.warn('Could not fetch users for assignment. Skipping user dropdown population. Error:', error.message);
        showMessage(`Could not load users for assignment: ${error.message}`, 'error');
    }
}

// --- Tag Functions ---

async function fetchTags() {
    try {
        const data = await fetchData('/tags');
        allTags = data.tags; // Store fetched tags globally
        if (tagsList) { // If tagsList element exists
            tagsList.innerHTML = ''; // Clear previous tags
            // Filter out soft-deleted tags from display list
            const activeTags = allTags.filter(t => !t.is_deleted);
            if (activeTags.length === 0) {
                noTagsMessage.classList.remove('hidden');
            } else {
                noTagsMessage.classList.add('hidden');
                activeTags.forEach(tag => renderTag(tag));
            }
        }
        populateTaskTagsDropdown(allTags); // Populate tags in the create task form
        populateEditTaskTagDropdown(allTags); // Populate tags in the edit task modal
        populateTaskFilterTagDropdown(allTags); // Populate tags in the filter dropdown
    } catch (error) {
        console.warn('Could not fetch tags. Error:', error.message);
        showMessage(`Could not load tags: ${error.message}`, 'error');
    }
}

function renderTag(tag) {
    if (!tagsList) return;
    const tagDiv = document.createElement('div');
    tagDiv.id = `tag-${tag.id}`;
    // Show a visual cue if tag is soft-deleted (for admin view)
    const bgColor = tag.is_deleted ? 'bg-gray-300' : 'bg-gray-200';
    const textColor = tag.is_deleted ? 'text-gray-500' : 'text-gray-700';

    tagDiv.className = `${bgColor} rounded-full px-4 py-2 text-sm font-semibold ${textColor} flex items-center justify-between shadow-sm`;
    tagDiv.innerHTML = `
        <span>${tag.name} ${tag.is_deleted ? '(Deleted)' : ''}</span>
        <button data-id="${tag.id}" class="delete-tag-btn ml-2 text-red-500 hover:text-red-700 transition">
            &times;
        </button>
    `;
    tagsList.appendChild(tagDiv);

    const deleteBtn = tagDiv.querySelector('.delete-tag-btn');
    deleteBtn.addEventListener('click', (e) => {
        const tagId = e.target.dataset.id;
        // Conditional disabling based on user role (e.g., only admin or tag creator can delete)
        const tagCreatorId = tag.created_by; // Assuming 'created_by' is returned in tag object
        if (currentUser.role === 'admin' || currentUser.user_id === tagCreatorId) {
            if (confirm(`Are you sure you want to delete tag "${tag.name}"? This will soft-delete it.`)) {
                deleteTag(tagId);
            }
        } else {
            showMessage('You do not have permission to delete this tag.', 'error');
            deleteBtn.disabled = true;
            deleteBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    });
    // Disable delete button if tag is soft-deleted or user has no permission
    if (tag.is_deleted || (currentUser.role !== 'admin' && currentUser.user_id !== tag.created_by)) {
        deleteBtn.disabled = true;
        deleteBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

async function handleCreateTag(e) {
    e.preventDefault();
    if (!tagNameInput) return;
    const name = tagNameInput.value.trim();
    if (!name) {
        showMessage('Tag name cannot be empty.', 'error');
        return;
    }

    try {
        await fetchData('/tags', 'POST', { name });
        tagNameInput.value = '';
        showMessage('Tag created!', 'success');
        // Fetch and re-render tags to update lists and dropdowns
        fetchTags(); 
    } catch (error) {
        showMessage(`Error creating tag: ${error.message}`, 'error');
    }
}

async function deleteTag(id) {
    try {
        await fetchData(`/tags/${id}`, 'DELETE');
        showMessage('Tag deleted!', 'success');
        // Fetch and re-render tags to update lists and dropdowns
        fetchTags(); 
    } catch (error) {
        showMessage(`Error deleting tag: ${error.message}`, 'error');
    }
}

// Populate multi-select tag dropdown for create task form
function populateTaskTagsDropdown(tags) {
    if (!taskTagsSelect) return;
    taskTagsSelect.innerHTML = ''; // Clear previous options
    // Filter out soft-deleted tags from dropdowns
    const activeTags = tags.filter(t => !t.is_deleted);
    activeTags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag.id;
        option.textContent = tag.name;
        taskTagsSelect.appendChild(option);
    });
}


// Populate multi-select tag dropdown for edit task modal
function populateEditTaskTagDropdown(tags) {
    if (!editTaskTagsSelect) return;
    editTaskTagsSelect.innerHTML = ''; // Clear previous options
    // Filter out soft-deleted tags from dropdowns
    const activeTags = tags.filter(t => !t.is_deleted);
    activeTags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag.id;
        option.textContent = tag.name;
        editTaskTagsSelect.appendChild(option);
    });
}

// Populate multi-select tag dropdown for task filter section
function populateTaskFilterTagDropdown(tags) {
    if (!taskFilterTagsSelect) return;
    taskFilterTagsSelect.innerHTML = ''; // Clear previous options
    // Filter out soft-deleted tags from dropdowns
    const activeTags = tags.filter(t => !t.is_deleted);
    activeTags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag.id;
        option.textContent = tag.name;
        taskFilterTagsSelect.appendChild(option);
    });
}


// --- Task Functions ---

async function fetchTasks(projectId = null, projectName = 'All Projects', filters = {}) {
    if (currentProjectNameSpan) {
        currentProjectNameSpan.textContent = projectName;
    }
    
    // Construct query parameters for filters
    const queryParams = new URLSearchParams();
    if (projectId) {
        queryParams.append('project_id', projectId);
    }
    if (filters.search) {
        queryParams.append('search', filters.search);
    }
    if (filters.priority) {
        queryParams.append('priority', filters.priority);
    }
    if (filters.status) {
        queryParams.append('status', filters.status);
    }
    if (filters.assigned_to) {
        queryParams.append('assigned_to', filters.assigned_to);
    }
    if (filters.tags && filters.tags.length > 0) {
        queryParams.append('tags', filters.tags.join(',')); // Send as comma-separated string
    }
    // Add due date range filters
    if (filters.due_date_start) {
        queryParams.append('due_date_start', filters.due_date_start);
    }
    if (filters.due_date_end) {
        queryParams.append('due_date_end', filters.due_date_end);
    }
    // Add sorting parameters
    if (filters.order_by) {
        queryParams.append('order_by', filters.order_by);
    }
    if (filters.order_direction) {
        queryParams.append('order_direction', filters.order_direction);
    }


    const endpoint = `/tasks?${queryParams.toString()}`;

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
    // Show a visual cue if task is soft-deleted (for admin view)
    const borderColor = task.is_deleted ? 'border-red-700' : 'border-yellow-500';
    const bgColor = task.is_deleted ? 'bg-red-100' : 'bg-white';

    taskDiv.className = `${bgColor} p-4 rounded-md shadow-sm flex justify-between items-start border-l-4 ${borderColor}`;

    // RENDER TAGS: Ensure tags are displayed with remove buttons
    const tagsHtml = task.tags ? task.tags.map(tag => `
        <span class="inline-flex items-center bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-2">
            ${tag.name}
            <button data-task-id="${task.id}" data-tag-id="${tag.id}" class="remove-tag-btn ml-1 text-gray-500 hover:text-red-700 transition text-xs font-bold">&times;</button>
        </span>
    `).join('') : '';

    taskDiv.innerHTML = `
        <div class="flex-grow">
            <h4 class="text-lg font-semibold text-gray-800">${task.title} ${task.is_deleted ? '(Deleted)' : ''}</h4>
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
                    data-tags='${JSON.stringify(task.tags || [])}'
                    class="edit-task-btn bg-yellow-500 text-white p-2 rounded-md text-sm hover:bg-yellow-600 transition shadow-sm">Edit</button>
            <button data-id="${task.id}" class="delete-task-btn bg-red-500 text-white p-2 rounded-md text-sm hover:bg-red-600 transition shadow-sm">Delete</button>
        </div>
    `;
    tasksList.appendChild(taskDiv);

    // Attach event listeners for edit task modal
    const editBtn = taskDiv.querySelector('.edit-task-btn');
    editBtn.addEventListener('click', (e) => {
        const taskId = e.target.dataset.id;
        const taskData = {
            id: taskId,
            title: e.target.dataset.title,
            description: e.target.dataset.description,
            due_date: e.target.dataset.dueDate, 
            priority: e.target.dataset.priority,
            status: e.target.dataset.status,
            assigned_to: task.assigned_to || '', // Use task.assigned_to directly
            project_id: task.project_id, // Use task.project_id directly
            parent_task_id: task.parent_task_id || '',
            tags: JSON.parse(e.target.dataset.tags || '[]') // Parse tags array
        };
        // Conditional disabling based on user role (e.g., only admin, creator, or assignee can edit)
        const taskCreatorId = task.created_by;
        const taskAssignedToId = task.assigned_to;
        if (currentUser.role === 'admin' || currentUser.user_id === taskCreatorId || currentUser.user_id === taskAssignedToId) {
            showEditTaskModal(taskData); 
        } else {
            showMessage('You do not have permission to edit this task.', 'error');
            editBtn.disabled = true; // Disable button if not authorized
            editBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    });

    const deleteBtn = taskDiv.querySelector('.delete-task-btn');
    deleteBtn.addEventListener('click', (e) => {
        const taskId = e.target.dataset.id;
        // Conditional disabling based on user role (e.g., only admin or task creator can delete)
        const taskCreatorId = task.created_by;
        if (currentUser.role === 'admin' || currentUser.user_id === taskCreatorId) {
            if (confirm(`Are you sure you want to delete task "${task.title}"? This will soft-delete it.`)) {
                deleteTask(taskId);
            }
        } else {
            showMessage('You do not have permission to delete this task.', 'error');
            deleteBtn.disabled = true; // Disable button if not authorized
            deleteBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    });

    // Event listeners for removing tags from tasks
    taskDiv.querySelectorAll('.remove-tag-btn').forEach(button => {
        const removeTagBtn = button; // Renamed for clarity
        removeTagBtn.addEventListener('click', async (e) => {
            const taskId = e.target.dataset.taskId;
            const tagId = e.target.dataset.tagId;
            // Conditional disabling based on user role
            const taskCreatorId = task.created_by;
            if (currentUser.role === 'admin' || currentUser.user_id === taskCreatorId) {
                if (confirm('Are you sure you want to remove this tag from the task?')) {
                    try {
                        await fetchData(`/tasks/${taskId}/tags/${tagId}`, 'DELETE');
                        showMessage('Tag removed from task!', 'success');
                        fetchTasks(currentProjectIdFilter, currentProjectNameSpan.textContent, getCurrentFilters()); // Re-fetch tasks with current filters
                    } catch (error) {
                        showMessage(`Error removing tag: ${error.message}`, 'error');
                    }
                }
            } else {
                showMessage('You do not have permission to remove tags from this task.', 'error');
                removeTagBtn.disabled = true; // Disable button if not authorized
                removeTagBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
        });
        // Disable button if task is soft-deleted or user has no permission
        if (task.is_deleted || (currentUser.role !== 'admin' && currentUser.user_id !== task.created_by)) {
            removeTagBtn.disabled = true;
            removeTagBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    });

    // Disable edit/delete buttons if task is soft-deleted
    if (task.is_deleted) {
        editBtn.disabled = true;
        editBtn.classList.add('opacity-50', 'cursor-not-allowed');
        deleteBtn.disabled = true;
        deleteBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

// Function to show and populate the edit task modal
function showEditTaskModal(task) {
    if (!editTaskModal) return;

    editTaskId.value = task.id;
    editTaskOriginalProjectId.value = task.project_id; 
    editTaskOriginalTagsInput.value = JSON.stringify(task.tags || []); // Store original tags as JSON string

    editTaskTitle.value = task.title;
    editTaskDescription.value = task.description;
    editTaskDueDate.value = task.due_date; 
    editTaskPrioritySelect.value = task.priority;
    editTaskStatusSelect.value = task.status;
    
    editTaskAssignedToSelect.value = task.assigned_to || ''; 
    editTaskProjectIdSelect.value = task.project_id || '';
    editTaskParentTaskIdInput.value = task.parent_task_id;

    // Select existing tags in the multi-select dropdown
    if (editTaskTagsSelect) {
        // Clear all selected options first
        Array.from(editTaskTagsSelect.options).forEach(option => {
            option.selected = false;
        });
        // Select options corresponding to task.tags
        task.tags.forEach(taskTag => {
            const option = editTaskTagsSelect.querySelector(`option[value="${taskTag.id}"]`);
            if (option) {
                option.selected = true;
            }
        });
    }

    editTaskModal.classList.remove('hidden'); 
}

// Function to hide the edit task modal
function hideEditTaskModal() {
    if (editTaskModal) {
        editTaskModal.classList.add('hidden');
        editTaskForm.reset(); 
        // Also clear tag selections and original tags on hide
        if (editTaskTagsSelect) {
            Array.from(editTaskTagsSelect.options).forEach(option => option.selected = false);
        }
        editTaskOriginalTagsInput.value = ''; // Clear original tags
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

    // Get selected tags from the multi-select
    const selectedTagIds = Array.from(editTaskTagsSelect.selectedOptions)
                                .map(option => parseInt(option.value));

    try {
        // First, update the task itself
        await updateTask(taskId, updates); 
        showMessage('Task updated successfully!', 'success');
        hideEditTaskModal(); 

        // Then, handle tag changes
        // Retrieve original tags from the hidden input
        const currentTaskTags = JSON.parse(editTaskOriginalTagsInput.value || '[]'); 


        const tagsToAdd = selectedTagIds.filter(id => !currentTaskTags.some(tag => tag.id === id));
        const tagsToRemove = currentTaskTags.filter(tag => !selectedTagIds.includes(tag.id)).map(tag => tag.id);

        for (const tagId of tagsToRemove) {
            await fetchData(`/tasks/${taskId}/tags/${tagId}`, 'DELETE');
        }
        for (const tagId of tagsToAdd) {
            await fetchData(`/tasks/${taskId}/tags/${tagId}`, 'POST');
        }
        
        // Re-fetch tasks with current filters after all updates
        fetchTasks(currentProjectIdFilter, currentProjectNameSpan.textContent, getCurrentFilters()); 

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
    
    // Get selected tags from the multi-select
    const selectedTagIds = Array.from(taskTagsSelect.selectedOptions)
                                .map(option => parseInt(option.value));

    if (!title || !project_id) {
        showMessage('Task title and project must be selected.', 'error');
        return;
    }

    try {
        const newTaskResponse = await fetchData('/tasks', 'POST', { // Get the response to access the new task ID
            title, description, due_date, priority, status,
            assigned_to: assigned_to ? parseInt(assigned_to) : null, 
            project_id: parseInt(project_id),
            parent_task_id: parent_task_id ? parseInt(parent_task_id) : null
        });
        
        // After creating the task, associate selected tags
        const newTaskId = newTaskResponse.task.id; // Access the ID from the response
        for (const tagId of selectedTagIds) {
            await fetchData(`/tasks/${newTaskId}/tags/${tagId}`, 'POST');
        }

        showMessage('Task created!', 'success');
        createTaskForm.reset(); 
        // Ensure dropdowns are reset after creation
        Array.from(taskTagsSelect.options).forEach(option => option.selected = false);
        // Also ensure multi-selects are cleared.
        if (editTaskTagsSelect) { // Check if editTaskTagsSelect is initialized
            Array.from(editTaskTagsSelect.options).forEach(option => option.selected = false); 
        }
        
        fetchTasks(currentProjectIdFilter, currentProjectNameSpan.textContent, getCurrentFilters()); // Re-fetch tasks with current filters


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

// Filter Functions
function getCurrentFilters() {
    return {
        search: taskFilterSearchInput.value.trim(),
        priority: taskFilterPrioritySelect.value,
        status: taskFilterStatusSelect.value,
        assigned_to: taskFilterAssignedToSelect.value || null,
        tags: Array.from(taskFilterTagsSelect.selectedOptions).map(option => parseInt(option.value)),
        // Add due date range filters
        due_date_start: taskFilterDueDateStart.value || null,
        due_date_end: taskFilterDueDateEnd.value || null,
        // Add sorting parameters
        order_by: taskFilterOrderBy.value,
        order_direction: taskFilterOrderDirection.value
    };
}

function applyFilters() {
    const filters = getCurrentFilters();
    fetchTasks(currentProjectIdFilter, currentProjectNameSpan.textContent, filters);
}

function clearFilters() {
    taskFilterSearchInput.value = '';
    taskFilterPrioritySelect.value = '';
    taskFilterStatusSelect.value = '';
    taskFilterAssignedToSelect.value = '';
    Array.from(taskFilterTagsSelect.options).forEach(option => option.selected = false);
    // Clear due date range filters
    taskFilterDueDateStart.value = '';
    taskFilterDueDateEnd.value = '';
    // Reset sorting to default
    taskFilterOrderBy.value = 'created_at';
    taskFilterOrderDirection.value = 'DESC';

    // After clearing filters, re-fetch tasks (possibly for the current project)
    fetchTasks(currentProjectIdFilter, currentProjectNameSpan.textContent);
}


// --- Notifications Functions (NEW) ---

async function fetchNotifications() {
    try {
        const data = await fetchData('/notifications');
        renderNotifications(data.notifications);
        updateNotificationsBadge(data.notifications.filter(n => !n.is_read).length);
    } catch (error) {
        showMessage(`Error fetching notifications: ${error.message}`, 'error');
    }
}

function renderNotifications(notifications) {
    if (!notificationsList) return;
    notificationsList.innerHTML = ''; // Clear existing notifications

    if (notifications.length === 0) {
        notificationsList.innerHTML = '<li class="text-center text-gray-500">No notifications.</li>';
        return;
    }

    notifications.forEach(notification => {
        const listItem = document.createElement('li');
        listItem.className = `p-3 mb-2 rounded-md shadow-sm ${notification.is_read ? 'bg-gray-100 text-gray-700' : 'bg-blue-50 text-blue-800 font-semibold'}`;
        listItem.dataset.notificationId = notification.id; // Store ID for marking as read

        let entityLink = '';
        if (notification.entity_type === 'TASK' && notification.entity_id) {
            entityLink = ` (<a href="#" data-task-id="${notification.entity_id}" class="notification-task-link text-blue-600 hover:underline">View Task</a>)`;
        } else if (notification.entity_type === 'PROJECT' && notification.entity_id) {
            entityLink = ` (<a href="#" data-project-id="${notification.entity_id}" class="notification-project-link text-blue-600 hover:underline">View Project</a>)`;
        }

        listItem.innerHTML = `
            ${notification.message} ${entityLink}
            <span class="block text-xs text-right ${notification.is_read ? 'text-gray-500' : 'text-blue-600'}">
                ${new Date(notification.created_at).toLocaleString()}
            </span>
        `;
        notificationsList.appendChild(listItem);
    });

    // Add event listeners for notification links (e.g., jump to task)
    notificationsList.querySelectorAll('.notification-task-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const taskId = e.target.dataset.taskId;
            // You would ideally scroll to the task or open its edit modal here
            // For now, we'll just log and maybe highlight:
            showMessage(`Clicked to view Task ID: ${taskId}`, 'info');
            // Implement logic to scroll to or highlight the task
        });
    });
    // Add event listeners for project links (if implemented)
    notificationsList.querySelectorAll('.notification-project-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const projectId = e.target.dataset.projectId;
            showMessage(`Clicked to view Project ID: ${projectId}`, 'info');
            // Implement logic to switch to project tasks or highlight project
        });
    });
}

function updateNotificationsBadge(count) {
    if (notificationsBadge) {
        if (count > 0) {
            notificationsBadge.textContent = count;
            notificationsBadge.classList.remove('hidden');
        } else {
            notificationsBadge.classList.add('hidden');
        }
    }
}

async function handleClearNotifications() {
    // Get all unread notification IDs
    const unreadNotifications = Array.from(notificationsList.children)
                                    .filter(li => !li.classList.contains('bg-gray-100'))
                                    .map(li => parseInt(li.dataset.notificationId));
    
    if (unreadNotifications.length === 0) {
        showMessage('No unread notifications to clear.', 'info');
        return;
    }

    try {
        await fetchData('/notifications/mark-read', 'POST', { notificationIds: unreadNotifications });
        showMessage('Notifications cleared!', 'success');
        fetchNotifications(); // Re-fetch to update UI
    } catch (error) {
        showMessage(`Error clearing notifications: ${error.message}`, 'error');
    }
}

function toggleNotificationsContainer() {
    if (notificationsContainer) {
        notificationsContainer.classList.toggle('hidden');
        if (!notificationsContainer.classList.contains('hidden')) {
            // When opening, ensure unread are fetched and then mark them read if visible
            fetchNotifications(); // Refresh in case new ones arrived
        }
    }
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
    taskTagsSelect = document.getElementById('task-tags'); // Assign tags multi-select for create task form

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
    editTaskTagsSelect = document.getElementById('edit-task-tags'); // Assign tags multi-select for edit task form
    editTaskOriginalTagsInput = document.getElementById('edit-task-original-tags'); // Assign hidden input

    // Edit Project Modal Elements
    editProjectModal = document.getElementById('edit-project-modal');
    editProjectForm = document.getElementById('edit-project-form');
    cancelEditProjectBtn = document.getElementById('cancel-edit-project-btn');
    editProjectId = document.getElementById('edit-project-id');
    editProjectName = document.getElementById('edit-project-name');
    editProjectDescription = document.getElementById('edit-project-description');

    // Tag Management Elements
    tagsSection = document.getElementById('tags-section'); 
    createTagForm = document.getElementById('create-tag-form');
    tagNameInput = document.getElementById('tag-name');
    tagsList = document.getElementById('tags-list');
    noTagsMessage = document.getElementById('no-tags-message');

    // Filter Elements
    taskFilterSearchInput = document.getElementById('task-filter-search');
    taskFilterPrioritySelect = document.getElementById('task-filter-priority');
    taskFilterStatusSelect = document.getElementById('task-filter-status');
    taskFilterAssignedToSelect = document.getElementById('task-filter-assigned-to');
    taskFilterTagsSelect = document.getElementById('task-filter-tags');
    applyFiltersBtn = document.getElementById('apply-filters-btn');
    clearFiltersBtn = document.getElementById('clear-filters-btn');
    taskFilterDueDateStart = document.getElementById('task-filter-due-date-start');
    taskFilterDueDateEnd = document.getElementById('task-filter-due-date-end');
    taskFilterOrderBy = document.getElementById('task-filter-order-by');
    taskFilterOrderDirection = document.getElementById('task-filter-order-direction');

    // NEW: Notification related DOM elements assignment
    notificationsContainer = document.getElementById('notifications-container');
    notificationsList = document.getElementById('notifications-list');
    notificationsBadge = document.getElementById('notifications-badge');
    clearNotificationsBtn = document.getElementById('clear-notifications-btn');
    const toggleNotificationsBtn = document.getElementById('toggle-notifications-btn'); // Assuming a button to open/close it


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

    // Event listeners for the edit project modal
    editProjectForm.addEventListener('submit', handleEditProjectSubmit);
    cancelEditProjectBtn.addEventListener('click', hideEditProjectModal);
    editProjectModal.addEventListener('click', (e) => {
        if (e.target === editProjectModal) {
            hideEditProjectModal();
        }
    });

    // Event listener for create tag form
    if (createTagForm) { 
        createTagForm.addEventListener('submit', handleCreateTag);
    }

    // Event listeners for filter controls - Trigger applyFilters on input/change
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyFilters);
    }
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearFilters);
    }

    if (taskFilterSearchInput) taskFilterSearchInput.addEventListener('input', applyFilters);
    if (taskFilterPrioritySelect) taskFilterPrioritySelect.addEventListener('change', applyFilters);
    if (taskFilterStatusSelect) taskFilterStatusSelect.addEventListener('change', applyFilters);
    if (taskFilterAssignedToSelect) taskFilterAssignedToSelect.addEventListener('change', applyFilters);
    if (taskFilterTagsSelect) taskFilterTagsSelect.addEventListener('change', applyFilters);
    if (taskFilterDueDateStart) taskFilterDueDateStart.addEventListener('change', applyFilters);
    if (taskFilterDueDateEnd) taskFilterDueDateEnd.addEventListener('change', applyFilters);
    if (taskFilterOrderBy) taskFilterOrderBy.addEventListener('change', applyFilters);
    if (taskFilterOrderDirection) taskFilterOrderDirection.addEventListener('change', applyFilters);

    // NEW: Notification event listeners
    if (toggleNotificationsBtn) {
        toggleNotificationsBtn.addEventListener('click', toggleNotificationsContainer);
    }
    if (clearNotificationsBtn) {
        clearNotificationsBtn.addEventListener('click', handleClearNotifications);
    }


    // Check for existing token/user in localStorage on page load
    currentToken = localStorage.getItem('jwt_token');
    currentUser = JSON.parse(localStorage.getItem('current_user'));

    renderApp(); 
    if (!currentToken) {
        console.warn("Not logged in. Initial task fetch will be unauthorized (expected).");
    }
});
