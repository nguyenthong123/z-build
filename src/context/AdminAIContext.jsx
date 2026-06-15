import React, { createContext, useContext } from 'react';
import { useAIAdvisor } from '../hooks/useAIAdvisor';

const AdminAIContext = createContext(null);

export const AdminAIProvider = ({ children }) => {
  const advisorState = useAIAdvisor(null, 'admin');
  
  return (
    <AdminAIContext.Provider value={advisorState}>
      {children}
    </AdminAIContext.Provider>
  );
};

export const useAdminAI = () => {
  return useContext(AdminAIContext);
};
