import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, serverTimestamp } from '@angular/fire/firestore';

import { UserInterface } from '../models/user';

@Injectable({
  providedIn: 'root',
})
export class User {


  private readonly firestore = inject(Firestore);


  async createUserDocument(authUID: string, userDataDto: Partial<UserInterface>): Promise<boolean> {
    try {
      const userPayload = {
        firstName: userDataDto.firstName ?? '',
        lastName: userDataDto.lastName ?? '',
        email: userDataDto.email ?? '',
        phone: userDataDto.phone ?? '',
        avatar: userDataDto.avatar ?? '',
        role: userDataDto.role ?? 'user',
        status: userDataDto.status ?? 'active',
        createdAt: serverTimestamp()
      };

      const userDocRef = doc(this.firestore, 'users', authUID);
      await setDoc(userDocRef, userPayload);

      console.log('User erfolgreich in Firestore angelegt mit ID:', authUID);
      return true;
    } catch (error) {
      console.error('ERROR user send to Firebase / Firestore:', error);
      return false;
    }
  }

  generateInitialsAvatar(firstName: string, lastName: string): string {
    const firstInitial = firstName.trim().charAt(0).toUpperCase();
    const lastInitial = lastName.trim().charAt(0).toUpperCase();
    return `${firstInitial}${lastInitial}`;
  }
}
