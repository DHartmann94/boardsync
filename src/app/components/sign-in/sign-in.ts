import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';

import { Firestore, collection, addDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-sign-in',
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    TranslatePipe,
  ],
  templateUrl: './sign-in.html',
  styleUrl: './sign-in.scss',
})
export class SignIn {
  //FIRESTORE-TEST
  private readonly firestore = inject(Firestore);

  async testFirestore(): Promise<void> {
    try {
      const usersCollection = collection(this.firestore, 'test');

      const docRef = await addDoc(usersCollection, {
        message: 'Firestore funktioniert!',
        createdAt: new Date(),
      });

      console.log('Firestore funktioniert!');
      console.log('Document ID:', docRef.id);
    } catch (error) {
      console.error('Firestore Fehler:', error);
    }
  }
  //FIRESTORE-TEST
}
