import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Alert,
  CircularProgress,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  Divider,
} from '@mui/material';
import { Computer } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

const UsersList = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [grades, setGrades] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [models, setModels] = useState([]);
  const [userModels, setUserModels] = useState([]);
  const navigate = useNavigate();

  // Fetch data (users, departments, grades, models)
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [usersResp, deptsResp, gradesResp, modelsResp] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/users`),
          axios.get(`${API_BASE_URL}/api/departments`),
          axios.get(`${API_BASE_URL}/api/grades`),
          axios.get(`${API_BASE_URL}/api/models`),
        ]);

        if (usersResp.data?.users) {
          setUsers(usersResp.data.users);
          setFilteredUsers(usersResp.data.users);
        } else {
          setError('No users found');
        }

        if (deptsResp.data?.departments) {
          setDepartments(deptsResp.data.departments);
        } else {
          setError('No departments found');
        }

        if (gradesResp.data?.grades) {
          setGrades(gradesResp.data.grades);
        } else {
          setError('No grades found');
        }

        if (modelsResp.data?.models) {
          setModels(modelsResp.data.models);
        } else {
          setError('No models found');
        }
      } catch (err) {
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter users based on selected department
  useEffect(() => {
    if (selectedDepartment) {
      setFilteredUsers(users.filter((user) => user.department_id === selectedDepartment));
    } else {
      setFilteredUsers(users);
    }
  }, [selectedDepartment, users]);

  // Fetch user models when dialog opens
  const handleOpenDialog = async (userId) => {
    setSelectedUserId(userId);
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/users/${userId}/models`);
      if (response.data?.models) {
        setUserModels(response.data.models);
      } else {
        setError('No models found for this user');
      }
    } catch (err) {
      setError('Failed to load user models');
    } finally {
      setLoading(false);
      setOpenDialog(true);
    }
  };

  // Handle checkbox change
  const handleModelToggle = async (modelId) => {
    try {
      const isAssigned = userModels.some((model) => model.id === modelId);
      if (isAssigned) {
        // Remove model
        await axios.delete(`${API_BASE_URL}/api/users/${selectedUserId}/models/${modelId}`);
        setUserModels(userModels.filter((model) => model.id !== modelId));
      } else {
        // Add model
        await axios.post(`${API_BASE_URL}/api/users/${selectedUserId}/models`, { modelId });
        const newModel = models.find((model) => model.id === modelId);
        setUserModels([...userModels, newModel]);
      }
    } catch (err) {
      setError('Failed to update model assignment');
    }
  };

  // Helper functions
  const getDepartmentName = (departmentId) => {
    return departments.find((d) => d.id === departmentId)?.name || 'N/A';
  };

  const getGradeName = (gradeId) => {
    return grades.find((g) => g.id === gradeId)?.name || 'N/A';
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedUserId(null);
    setUserModels([]);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        All Users
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <FormControl fullWidth sx={{ mb: 3, maxWidth: 300 }}>
            <InputLabel id="department-select-label">Select Department</InputLabel>
            <Select
              labelId="department-select-label"
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              label="Select Department"
            >
              <MenuItem value="">All Departments</MenuItem>
              {departments.map((dept) => (
                <MenuItem key={dept.id} value={dept.id}>
                  {dept.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
              <CircularProgress />
            </Box>
          ) : filteredUsers.length === 0 ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              No users found{selectedDepartment ? ' in selected department' : ''}
            </Alert>
          ) : (
            <Grid container spacing={3}>
              {filteredUsers.map((user) => (
                <Grid item xs={12} sm={6} md={6} key={user.id}>
                  <Card
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: '0.3s',
                      '&:hover': { boxShadow: 6 },
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" gutterBottom>
                        {user.username}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Grade: {getGradeName(user.grade_id)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Department: {getDepartmentName(user.department_id)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Role: {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </Typography>
                    </CardContent>
                    <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
                      <IconButton
                        color="primary"
                        onClick={() => handleOpenDialog(user.id)}
                        title="Assign Models"
                      >
                        <Computer />
                      </IconButton>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Available Models
              </Typography>
              <List>
                {models.map((model) => (
                  <ListItem key={model.id}>
                    <ListItemText primary={model.name} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Models to User</DialogTitle>
        <DialogContent sx={{ maxHeight: '400px', overflowY: 'auto' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <List>
              {models.map((model) => (
                <ListItem key={model.id}>
                  <Checkbox
                    checked={userModels.some((m) => m.id === model.id)}
                    onChange={() => handleModelToggle(model.id)}
                  />
                  <ListItemText primary={model.name} />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default UsersList;