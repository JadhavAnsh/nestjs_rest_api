import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private users = [
    {
      id: '1',
      name: 'Ansh Patel',
      email: 'ansh.patel@example.com',
      role: 'admin',
    },
    {
      id: '2',
      name: 'Riya Sharma',
      email: 'riya.sharma@example.com',
      role: 'user',
    },
    {
      id: '3',
      name: 'Dev Mehta',
      email: 'dev.mehta@example.com',
      role: 'admin',
    },
    {
      id: '4',
      name: 'Sara Khan',
      email: 'sara.khan@example.com',
      role: 'user',
    },
    {
      id: '5',
      name: 'Aman Verma',
      email: 'aman.verma@example.com',
      role: 'admin',
    },
  ];

  // Find all users
  findAll(role?: 'admin' | 'user') {
    if (role) {
      return this.users.filter((user) => user.role === role);
    }
    if (this.users.length === 0) {
      throw new NotFoundException('No users found');
    }
    return this.users;
  }

  // Find a user by ID
  findOne(id: number) {
    const user = this.users.find((user) => user.id === id.toString());

    if (!user) {
      throw new NotFoundException('User not found');
    } else {
      return {
        message: 'User retrieved successfully',
        user,
        status: 200,
        error: null,
      };
    }
  }

  // Create a new user
  create(user: CreateUserDto) {
    const newUser = {
      id: (this.users.length + 1).toString(),
      ...user,
    };
    this.users.push(newUser);
    return {
      message: 'User created successfully',
      user: newUser,
      status: 201,
      error: null,
    };
  }

  // Update a user by ID
  update(id: number, userUpdate: UpdateUserDto) {
    // Check if user exists
    const existingUser = this.users.find((user) => user.id === id.toString());

    if (!existingUser) {
      return {
        message: 'User not found',
        user: null,
        status: 404,
        error: 'User not found',
      };
    }

    // Update the user
    this.users = this.users.map((user) => {
      if (user.id === id.toString()) {
        return {
          ...user,
          ...userUpdate,
        };
      }
      return user;
    });

    const updatedUser = this.users.find((user) => user.id === id.toString());

    return {
      message: 'User updated successfully',
      user: updatedUser,
      status: 200,
      error: null,
    };
  }

  // Delete a user by ID
  delete(id: number) {
    const deletedUser = this.findOne(id);
    this.users = this.users.filter((user) => user.id !== id.toString());
    if (deletedUser.user) {
      return {
        message: 'User deleted successfully',
        user: deletedUser.user,
        status: 200,
        error: null,
      };
    }
    return {
      message: 'User not found',
      user: null,
      status: 404,
      error: 'User not found',
    };
  }
}
